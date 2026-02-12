import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

const LoginPage = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  
  // Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formData, setFormData] = useState({ firstname: '', lastname: '', position: '' });
  
  // UI States
  const [step, setStep] = useState(1); // 1: Email, 2: Login/Pass, 3: Register Details
  const [loading, setLoading] = useState(false);

  // --- Handlers ---

  const handleContinue = async (e) => {
    e.preventDefault();
    if (!email.includes("@")) return alert("Bitte eine gültige E-Mail eingeben.");
    
    // For MVP: We assume the user might exist and move to password. 
    // If Ilia adds a "check-user" endpoint later, we would call it here.
    setStep(2); 
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await authAPI.login({
        username: email, // Ilia's backend uses email as username
        password: password
      });
      
      onLoginSuccess(response.data); // Updates App.jsx state
      navigate('/netzwerk');
    } catch (err) {
      // If login fails, we give the option to register (Step 3)
      alert("Anmeldung fehlgeschlagen. Passwort falsch oder Konto existiert nicht.");
      setStep(3);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.register({
        ...formData,
        email,
        username: email,
        password,
        role: "user"
      });
      alert("Konto erfolgreich erstellt!");
      // After registering, we log them in automatically
      handleLogin(e);
    } catch (err) {
      alert("Registrierung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-10 px-6 py-[60px] w-full bg-white min-h-screen">
      
      {/* 1. Back Button */}
      <div className="flex items-center px-6 md:px-[85px] py-4 w-full max-w-[1240px] bg-[#f4f6f5] rounded-lg">
        <button 
          onClick={() => step === 1 ? navigate(-1) : setStep(1)} 
          className="flex items-center gap-2 text-[#1f5f4a] font-bold"
        >
          <span className="rotate-[-90deg]">↑</span> Zurück
        </button>
      </div>

      {/* 2. Login/Register Card */}
      <div className="flex flex-col gap-[30px] p-[30px] bg-[#f4f6f5] rounded-lg w-full max-w-[505px]">
        <h2 className="font-['Roboto'] font-medium text-[#1f5f4a] text-2xl">
          {step === 1 && "Anmelden oder Konto erstellen"}
          {step === 2 && "Willkommen zurück"}
          {step === 3 && "Konto vervollständigen"}
        </h2>

        <form onSubmit={step === 1 ? handleContinue : (step === 2 ? handleLogin : handleRegister)} className="flex flex-col gap-5">
          
          {/* STEP 1: Email Capture */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <p className="text-[#1e1e1e] text-base">Gib zuerst deine E-Mail-Adresse ein.</p>
              <div className="flex flex-col gap-1">
                <label className="text-[#1f5f4a] font-medium">E-Mail-Adresse</label>
                <input 
                  type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="E-Mail-Adresse eingeben…"
                  className="p-3 bg-white rounded border border-[#5f6f68] outline-none focus:border-[#34b67a]"
                />
              </div>
              <button type="submit" className="w-full py-3 bg-[#34b67a] text-white rounded-[15px] font-medium shadow-md">
                Weiter
              </button>
            </div>
          )}

          {/* STEP 2: Password (Existing User) */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-gray-600">Passwort für <b>{email}</b> eingeben:</p>
              <input 
                type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Passwort"
                className="p-3 bg-white rounded border border-[#5f6f68] outline-none focus:border-[#34b67a]"
                autoFocus
              />
              <button disabled={loading} type="submit" className="w-full py-3 bg-[#34b67a] text-white rounded-[15px] font-medium shadow-md">
                {loading ? "Wird geladen..." : "Einloggen"}
              </button>
              <button type="button" onClick={() => setStep(3)} className="text-sm text-[#1f5f4a] underline text-center">
                Ich habe noch kein Konto
              </button>
            </div>
          )}

          {/* STEP 3: Registration Details (New User) */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Vorname" required className="p-2 border rounded"
                  onChange={e => setFormData({...formData, firstname: e.target.value})} />
                <input type="text" placeholder="Nachname" required className="p-2 border rounded"
                  onChange={e => setFormData({...formData, lastname: e.target.value})} />
              </div>
              <input type="text" placeholder="Position (z.B. Landwirt)" className="p-2 border rounded"
                onChange={e => setFormData({...formData, position: e.target.value})} />
              <input type="password" placeholder="Wunschpasswort festlegen" required className="p-2 border rounded"
                onChange={e => setPassword(e.target.value)} />
              
              <button disabled={loading} type="submit" className="w-full py-3 bg-[#34b67a] text-white rounded-[15px] font-medium shadow-md">
                Konto erstellen & Einloggen
              </button>
            </div>
          )}
        </form>

        {/* Social Dividers (Only on Step 1) */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
             <div className="flex items-center gap-2 text-gray-400"><div className="h-px bg-gray-300 flex-1"></div>oder<div className="h-px bg-gray-300 flex-1"></div></div>
             <div className="flex justify-center gap-5">
                <button className="p-4 bg-white shadow rounded-lg hover:bg-gray-50"><img src="https://c.animaapp.com/mkm0v5mgChGnL6/img/google.svg" className="w-8 h-8" alt="Google"/></button>
                <button className="p-4 bg-white shadow rounded-lg hover:bg-gray-50"><img src="https://c.animaapp.com/mkm0v5mgChGnL6/img/apple.svg" className="w-8 h-8" alt="Apple"/></button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;