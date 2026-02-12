import React, { useState } from 'react';

const SubscriptionBanner = () => {
  const [email, setEmail] = useState("");

  const handleSubscribe = (e) => {
    e.preventDefault();
    console.log("Subscribing email:", email);
    // This will connect to Ilia's subscribeToA/B endpoints later
  };

  return (
    <div className="flex items-start gap-5 w-full max-w-[1240px] mx-auto my-12 h-[347px]">
      
      {/* 1. Left Decorative Image */}
      <div 
        className="hidden lg:block flex-1 self-stretch rounded-lg bg-cover bg-center"
        style={{ backgroundImage: `url('https://c.animaapp.com/mklwynogVVghMQ/img/frame-42.png')` }}
      />

      {/* 2. Central Subscription Form */}
      <div className="flex flex-col items-start gap-[30px] p-[30px] bg-[#f4f6f5] rounded-lg flex-[1.5] lg:flex-none lg:w-[505px]">
        <div className="flex flex-col items-start gap-5 w-full">
          <h2 className="font-['Roboto'] font-medium text-[#1f5f4a] text-2xl leading-[35px]">
            Nichts verpassen!
          </h2>
          
          <form onSubmit={handleSubscribe} className="flex flex-col gap-5 w-full">
            <div className="flex flex-col gap-2.5 w-full">
              <p className="text-[#1e1e1e] text-base leading-[25px] font-['Roboto']">
                Erhalte ausgewählte Fragen, Antworten und Diskussionen aus der Community direkt per E-Mail.
              </p>
              
              {/* Input Field */}
              <div className="px-[15px] py-2.5 bg-white rounded-[5px] border border-[#5f6f68] focus-within:ring-2 focus-within:ring-[#34b67a]">
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="E-Mail-Adresse eingeben…"
                  className="w-full bg-transparent border-none outline-none text-[#5f6f68] text-base font-['Roboto']"
                  required
                />
              </div>
            </div>

            {/* Subscribe Button */}
            <button 
              type="submit"
              className="w-full py-2.5 bg-[#34b67a] hover:bg-[#2d9d68] text-white rounded-[15px] font-medium text-base shadow-md transition-all active:scale-95"
            >
              Abbonieren
            </button>
          </form>
        </div>

        {/* Legal / Unsubscribe Note */}
        <p className="w-full text-[#5f6f68] text-sm text-center font-['Roboto']">
          Du kannst dich jederzeit über dein Profil oder den Abmeldelink in jeder E-Mail abmelden.
        </p>
      </div>

      {/* 3. Right Decorative Image */}
      <div 
        className="hidden lg:block flex-1 self-stretch rounded-lg bg-cover bg-center"
        style={{ backgroundImage: `url('https://c.animaapp.com/mklwynogVVghMQ/img/frame-43.png')` }}
      />
      
    </div>
  );
};

export default SubscriptionBanner;