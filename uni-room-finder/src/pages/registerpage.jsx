import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    firstname: '', lastname: '', email: '', username: '', password: '', role: 'user', position: ''
  });
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await authAPI.register(formData);
      alert("Registrierung erfolgreich! Bitte melden Sie sich an.");
      navigate('/login');
    } catch (error) {
      alert("Fehler bei der Registrierung.");
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-[#f4f6f5] py-10">
      <div className="bg-white p-10 rounded-[15px] shadow-lg w-full max-w-lg">
        <h2 className="text-2xl font-bold text-[#1f5f4a] mb-6 text-center">Konto erstellen</h2>
        <form onSubmit={handleRegister} className="grid grid-cols-2 gap-4">
          <input type="text" placeholder="Vorname" className="p-3 border rounded-[5px]" onChange={e => setFormData({...formData, firstname: e.target.value})} />
          <input type="text" placeholder="Nachname" className="p-3 border rounded-[5px]" onChange={e => setFormData({...formData, lastname: e.target.value})} />
          <input type="email" placeholder="E-Mail" className="col-span-2 p-3 border rounded-[5px]" onChange={e => setFormData({...formData, email: e.target.value})} />
          <input type="text" placeholder="Wunsch-Benutzername" className="col-span-2 p-3 border rounded-[5px]" onChange={e => setFormData({...formData, username: e.target.value})} />
          <input type="password" placeholder="Passwort" className="col-span-2 p-3 border rounded-[5px]" onChange={e => setFormData({...formData, password: e.target.value})} />
          <input type="text" placeholder="Position (z.B. Landwirt)" className="col-span-2 p-3 border rounded-[5px]" onChange={e => setFormData({...formData, position: e.target.value})} />
          
          <button type="submit" className="col-span-2 bg-[#34b67a] text-white py-3 rounded-[15px] font-medium mt-4">
            Registrieren
          </button>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;