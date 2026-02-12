import React from 'react';

const Sidebar = () => {
  return (
    <div className="flex flex-col gap-5 w-full max-w-[380px] grow">
      
      {/* Search Box Card */}
      <div className="flex flex-col items-start gap-5 p-[30px] bg-[#f4f6f5] rounded-lg relative self-stretch">
        <div className="flex items-center justify-center gap-[5px] px-4 py-2.5 w-full bg-white rounded-[5px] border border-solid border-[#5f6f68] focus-within:border-[#34b67a] transition-colors">
          <img 
            className="w-[22px] h-[22px]" 
            alt="Search Icon" 
            src="https://c.animaapp.com/mklwynogVVghMQ/img/component-1.svg" 
          />
          <input 
            type="text" 
            placeholder="Forum durchsuchen..." 
            className="w-full bg-transparent border-none outline-none [font-family:'Roboto',Helvetica] font-normal text-[#5f6f68] text-base leading-[25px]"
          />
        </div>
        <p className="self-stretch [font-family:'Roboto',Helvetica] font-normal text-[#1e1e1e] text-base text-center leading-[25px]">
          Durchsuche Fragen und Diskussionen, um hilfreiche Informationen für deinen Garten oder Hof zu finden.
        </p>
      </div>

      {/* Call to Action Card: "Ask a Question" */}
      <div className="flex flex-col items-start gap-5 p-[30px] bg-[#f4f6f5] rounded-lg relative self-stretch">
        <p className="self-stretch mt-[-1.00px] [font-family:'Roboto',Helvetica] font-normal text-[#1e1e1e] text-base text-center leading-[25px]">
          Keinen passenden Beitrag gefunden?<br />
          Dann stelle deine eigene Frage!
        </p>
        
        <button className="w-full flex items-center justify-center gap-[15px] px-[30px] py-2.5 bg-[#34b67a] hover:bg-[#2d9d68] rounded-[15px] shadow-md transition-all active:scale-95 border-none cursor-pointer">
          <span className="[font-family:'Roboto',Helvetica] font-medium text-white text-base text-center leading-[25px] whitespace-nowrap">
            Frage erstellen
          </span>
        </button>
      </div>

    </div>
  );
};

export default Sidebar;