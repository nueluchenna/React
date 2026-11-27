#!/usr/bin/env python3
"""
Manni — Standalone Receipt Pipeline Lab (scripts/receipt_lab.py)
Isolates and benchmarks all 3 receipt extraction stages on any image:
  1. Image Preprocessing + Raw OCR Text (pytesseract or rapidocr-onnxruntime)
  2. Regex Heuristic Parser (offline European/German/English rules)
  3. Groq Structured JSON LLM Parser (default: openai/gpt-oss-120b)

Usage:
  python scripts/receipt_lab.py "receipt sample.png" --api-key gsk_...
  # Or with GROQ_API_KEY env var:
  $env:GROQ_API_KEY="gsk_..."; python scripts/receipt_lab.py "receipt sample.png"
  # Optional: save full comparison JSON
  python scripts/receipt_lab.py "receipt sample.png" --save-json lab_report.json
"""

import argparse
import datetime
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

CATEGORIES = [
    "Groceries",
    "Food & Drink",
    "Transport",
    "Shopping",
    "Housing",
    "Utilities",
    "Entertainment",
    "Health",
    "Travel",
    "Income",
    "Other",
]

DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b"


# ---------------------------------------------------------------------------
# STAGE 1: Image Preprocessing + OCR
# ---------------------------------------------------------------------------
def preprocess_image(image_path: Path) -> Tuple[Any, Optional[Path]]:
    """
    Preserves horizontal resolution (up to 1600px wide, allowing tall receipt height),
    converts to grayscale, applies autocontrast & mild sharpening.
    """
    try:
        from PIL import Image, ImageFilter, ImageOps
    except ImportError:
        return None, None

    img = Image.open(image_path)
    img = ImageOps.exif_transpose(img)
    w, h = img.size
    max_w, max_h = 1600, 4400
    if w > max_w:
        h = int(h * max_w / w)
        w = max_w
    if h > max_h:
        w = int(w * max_h / h)
        h = max_h
    if (w, h) != img.size:
        img = img.resize((max(1, w), max(1, h)), Image.Resampling.LANCZOS)

    gray = ImageOps.grayscale(img)
    boosted = ImageOps.autocontrast(gray, cutoff=2)
    sharpened = boosted.filter(ImageFilter.SHARPEN)

    out_path = image_path.with_name(f"{image_path.stem}_preprocessed.png")
    sharpened.save(out_path)
    return sharpened, out_path


def run_ocr(image_path: Path, lang: str = "eng") -> Dict[str, Any]:
    start = time.perf_counter()
    preprocessed_img, preprocessed_path = preprocess_image(image_path)

    # Try pytesseract first
    try:
        import pytesseract

        target = preprocessed_img if preprocessed_img is not None else str(image_path)
        raw_text = pytesseract.image_to_string(target, lang=lang, config="--psm 6")
        return {
            "engine": f"pytesseract ({lang})",
            "durationMs": int((time.perf_counter() - start) * 1000),
            "preprocessedPath": str(preprocessed_path) if preprocessed_path else None,
            "rawText": raw_text.strip(),
        }
    except ImportError:
        pass
    except Exception as exc:
        # pytesseract installed, but Tesseract binary or lang pack missing
        print(f"[Stage 1 Warning] pytesseract error: {exc}", file=sys.stderr)

    # Fallback: try rapidocr-onnxruntime (zero external binary required!)
    try:
        from rapidocr_onnxruntime import RapidOCR

        ocr = RapidOCR()
        target_path = str(preprocessed_path or image_path)
        result, _ = ocr(target_path)
        lines = [item[1] for item in (result or []) if len(item) >= 2]
        return {
            "engine": "rapidocr-onnxruntime",
            "durationMs": int((time.perf_counter() - start) * 1000),
            "preprocessedPath": str(preprocessed_path) if preprocessed_path else None,
            "rawText": "\n".join(lines),
        }
    except ImportError:
        pass

    return {
        "engine": "none",
        "durationMs": int((time.perf_counter() - start) * 1000),
        "preprocessedPath": str(preprocessed_path) if preprocessed_path else None,
        "rawText": "",
        "error": (
            "No Python OCR package found. Install one with:\n"
            "  pip install pillow rapidocr-onnxruntime\n"
            "  # or: pip install pillow pytesseract  (requires Tesseract OCR binary)"
        ),
    }


# ---------------------------------------------------------------------------
# STAGE 2: Isolated Regex Heuristic Parser (mirrors regexReceiptParser.ts)
# ---------------------------------------------------------------------------
def _parse_num(raw: str) -> float:
    try:
        return float(raw.replace(" ", "").replace(",", "."))
    except ValueError:
        return 0.0


def parse_with_regex(raw_text: str, default_currency: str = "EUR") -> Dict[str, Any]:
    start = time.perf_counter()
    lines = [l.strip() for l in raw_text.splitlines() if len(l.strip()) > 1]

    currency = default_currency
    if "€" in raw_text or re.search(r"\bEUR\b", raw_text, re.I):
        currency = "EUR"
    elif "£" in raw_text or re.search(r"\bGBP\b", raw_text, re.I):
        currency = "GBP"
    elif "$" in raw_text or re.search(r"\bUSD\b", raw_text, re.I):
        currency = "USD"

    known_merchants = [
        (r"\blidl\b", "Lidl"),
        (r"\baldi\b", "Aldi"),
        (r"\brewe\b", "REWE"),
        (r"\bedeka\b", "EDEKA"),
        (r"\bkaufland\b", "Kaufland"),
        (r"\bpenny\b", "Penny"),
        (r"\bnetto\b", "Netto"),
        (r"\bdm[\s-]?drogerie", "dm-drogerie markt"),
        (r"\brossmann\b", "Rossmann"),
        (r"\bcarrefour\b", "Carrefour"),
        (r"\btesco\b", "Tesco"),
        (r"\bikea\b", "IKEA"),
    ]
    merchant = "Scanned Receipt"
    for pat, name in known_merchants:
        if re.search(pat, raw_text, re.I):
            merchant = name
            break
    else:
        for line in lines[:6]:
            clean = re.sub(r"[^a-zA-Z0-9\s&'.-]", "", line).strip()
            if (
                len(clean) >= 3
                and not re.match(
                    r"^(date|datum|time|zeit|receipt|bon|beleg|tel|phone|tax|vat|mwst|ust|eur)",
                    clean,
                    re.I,
                )
                and not clean.isdigit()
            ):
                merchant = " ".join(w.capitalize() for w in clean.split()[:4])
                break

    today = datetime.date.today().isoformat()
    date_str = today
    iso_m = re.search(r"\b(20\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b", raw_text)
    dmy_m = re.search(r"\b(0?[1-9]|[12]\d|3[01])[./-](0?[1-9]|1[0-2])[./-](20\d{2}|\d{2})\b", raw_text)
    if iso_m:
        date_str = f"{iso_m.group(1)}-{iso_m.group(2)}-{iso_m.group(3)}"
    elif dmy_m:
        day, mon, yr = dmy_m.group(1).zfill(2), dmy_m.group(2).zfill(2), dmy_m.group(3)
        if len(yr) == 2:
            yr = f"20{yr}"
        date_str = f"{yr}-{mon}-{day}"

    total_re = re.compile(
        r"\b(zu\s*zahlen|summe|gesamt(?:betrag)?|ald[iy1]\s*preis|total|amount\s*due|grand\s*total|kartenzah[li1]ung|ec-karte|visa|mastercard|bezahlt|bar)\b[^0-9]*?(\d{1,5}[.,]\d{2})\b",
        re.I,
    )
    tax_re = re.compile(r"\b(tax|vat|mwst|ust|tva|gst|steuer)\b[^0-9]*?(\d{1,4}[.,]\d{2})\b", re.I)
    item_re = re.compile(r"^(.+?)\s+[€$£]?(-?\d{1,4}[.,]\d{2})\s*[A-Z*]?$")

    explicit_total = 0.0
    tax_amount: Optional[float] = None
    line_items: List[Dict[str, Any]] = []

    for i, line in enumerate(lines):
        tm = total_re.search(line)
        if tm:
            val = _parse_num(tm.group(2))
            if val > explicit_total:
                explicit_total = val
            continue

        if re.match(r"^(zu\s*zahlen|summe|gesamt|total)\b", line, re.I) and i + 1 < len(lines):
            nm = re.search(r"(\d{1,5}[.,]\d{2})", lines[i + 1])
            if nm:
                val = _parse_num(nm.group(1))
                if val > explicit_total:
                    explicit_total = val
                continue

        vm = tax_re.search(line)
        if vm:
            val = _parse_num(vm.group(2))
            if val > 0:
                tax_amount = val
            continue

        im = item_re.match(line)
        if im:
            raw_name = re.sub(r"[.*_=-]{2,}", " ", im.group(1)).strip()
            price = _parse_num(im.group(2))
            if (
                len(raw_name) >= 2
                and 0 < price < 5000
                and not re.search(
                    r"\b(subtotal|zwischensumme|rückgeld|rueckgeld|change|gegeben|cash|visa|mastercard|card|rabatt|discount|brutto|netto|mwst)\b",
                    raw_name,
                    re.I,
                )
            ):
                line_items.append(
                    {
                        "name": raw_name,
                        "quantity": 1,
                        "unitPrice": price,
                        "totalPrice": price,
                    }
                )

    if explicit_total <= 0:
        all_nums = [
            _parse_num(m.group(1))
            for m in re.finditer(r"(?:^|[\s€$£])(\d{1,4}[.,]\d{2})(?:\s*[A-Z]?$|\s)", raw_text, re.M)
        ]
        all_nums = [n for n in all_nums if 0 < n < 10000]
        if all_nums:
            explicit_total = max(all_nums)

    items_sum = round(sum(it["totalPrice"] for it in line_items), 2)
    total_amount = explicit_total if explicit_total > 0 else items_sum

    return {
        "merchant": merchant,
        "date": date_str,
        "currency": currency,
        "totalAmount": total_amount,
        "taxAmount": tax_amount,
        "lineItemsCount": len(line_items),
        "lineItems": line_items,
        "durationMs": int((time.perf_counter() - start) * 1000),
    }


# ---------------------------------------------------------------------------
# STAGE 3: Isolated Groq Structured JSON Parser
# ---------------------------------------------------------------------------
def parse_with_groq(
    raw_ocr_text: str,
    api_key: str,
    model: str = DEFAULT_GROQ_MODEL,
    default_currency: str = "EUR",
) -> Dict[str, Any]:
    start = time.perf_counter()
    today = datetime.date.today().isoformat()

    system_prompt = (
        "You are a precise receipt extraction engine. Return ONLY a valid JSON object matching:\n"
        "{\n"
        '  "merchant": "Store name",\n'
        f'  "date": "YYYY-MM-DD (fallback {today})",\n'
        f'  "currency": "3-letter ISO code (default {default_currency})",\n'
        '  "totalAmount": 0.00,\n'
        '  "taxAmount": 0.00,\n'
        f'  "category": "One of: {", ".join(CATEGORIES)}",\n'
        '  "summaryNote": "Short 3-6 word summary",\n'
        '  "lineItems": [{"name": "Item", "quantity": 1, "unitPrice": 0.00, "totalPrice": 0.00}]\n'
        "}\n"
        "CRITICAL RULES:\n"
        "1. Supermarkets (Aldi, Aldi Süd, Lidl, REWE, EDEKA, Kaufland, Netto, Penny, Tesco, Carrefour) MUST be categorized as 'Groceries' (never 'Shopping').\n"
        "2. Look for ALDI PREIS / ALDY PREIS / SUMME / zu zahlen / Kartenzahlung / Kartenzahiung / TOTAL.\n"
        "3. Repair dropped-comma OCR prices before tax letters (e.g. 179A = 1.79, 378A = 3.78/3.75) so lineItems sum to totalAmount.\n"
        "4. Combine multi-quantity lines (e.g. '3 x 0,79 =' above 'Hummus 2,37 A' -> quantity: 3, unitPrice: 0.79, totalPrice: 2.37) and strip 5-6 digit SKU prefixes."
    )

    payload = json.dumps(
        {
            "model": model,
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"Extract all receipt fields and line items from this raw OCR text:\n\n{raw_ocr_text}",
                },
            ],
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key.strip()}",
            "User-Agent": "Manni-Receipt-Lab/1.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        content = body["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        return {
            "model": model,
            "durationMs": int((time.perf_counter() - start) * 1000),
            "parsed": parsed,
        }
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="ignore")
        return {
            "model": model,
            "durationMs": int((time.perf_counter() - start) * 1000),
            "error": f"HTTP {e.code}: {err_body[:300]}",
        }
    except Exception as e:
        return {
            "model": model,
            "durationMs": int((time.perf_counter() - start) * 1000),
            "error": str(e),
        }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Manni Receipt Pipeline Lab — Isolate OCR, Regex, and Groq outputs."
    )
    parser.add_argument(
        "image",
        nargs="?",
        default="receipt sample.png",
        help="Path to receipt image (default: 'receipt sample.png')",
    )
    parser.add_argument("--api-key", default=os.getenv("GROQ_API_KEY", ""), help="Groq API key (or set GROQ_API_KEY)")
    parser.add_argument("--model", default=DEFAULT_GROQ_MODEL, help=f"Groq model ID (default: {DEFAULT_GROQ_MODEL})")
    parser.add_argument("--lang", default="eng", help="Tesseract language (e.g. 'eng' or 'eng+deu')")
    parser.add_argument("--ocr-text-file", default="", help="Optional raw OCR .txt file to skip Stage 1")
    parser.add_argument("--save-json", default="", help="Optional path to save full 3-stage comparison JSON")
    args = parser.parse_args()

    # Stage 1
    print("=" * 72)
    print("STAGE 1: IMAGE PREPROCESSING + RAW OCR")
    print("=" * 72)
    if args.ocr_text_file:
        raw_text = Path(args.ocr_text_file).read_text(encoding="utf-8")
        stage1 = {"engine": "file", "durationMs": 0, "rawText": raw_text}
    else:
        img_path = Path(args.image)
        if not img_path.exists():
            print(f"Error: Image not found at {img_path.resolve()}", file=sys.stderr)
            sys.exit(1)
        stage1 = run_ocr(img_path, lang=args.lang)
        raw_text = stage1.get("rawText", "")

    print(f"Engine: {stage1.get('engine')} | Time: {stage1.get('durationMs')} ms")
    if stage1.get("preprocessedPath"):
        print(f"Preprocessed preview saved: {stage1['preprocessedPath']}")
    if stage1.get("error"):
        print(f"\n{stage1['error']}\n")
    else:
        print("\n--- RAW OCR TEXT ---")
        print(raw_text or "(empty)")

    # Stage 2
    print("\n" + "=" * 72)
    print("STAGE 2: ISOLATED REGEX HEURISTIC PARSER")
    print("=" * 72)
    stage2 = parse_with_regex(raw_text)
    print(json.dumps(stage2, indent=2, ensure_ascii=False))

    # Stage 3
    print("\n" + "=" * 72)
    print(f"STAGE 3: ISOLATED GROQ STRUCTURED JSON ({args.model})")
    print("=" * 72)
    if not args.api_key:
        stage3: Dict[str, Any] = {"skipped": "Pass --api-key gsk_... or set GROQ_API_KEY to test Stage 3."}
        print(stage3["skipped"])
    elif not raw_text.strip():
        stage3 = {"skipped": "Stage 1 produced empty OCR text; fix OCR first."}
        print(stage3["skipped"])
    else:
        stage3 = parse_with_groq(raw_text, api_key=args.api_key, model=args.model)
        print(json.dumps(stage3, indent=2, ensure_ascii=False))

    if args.save_json:
        report = {"stage1_ocr": stage1, "stage2_regex": stage2, "stage3_groq": stage3}
        Path(args.save_json).write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"\nSaved full 3-stage report to {args.save_json}")


if __name__ == "__main__":
    main()
