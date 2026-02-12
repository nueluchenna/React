import React from 'react';

const Footer = () => {
  const links = ['Impressum', 'Datenschutz', 'Sitemap'];

  return (
    <footer className="flex flex-col lg:flex-row w-full items-center justify-around gap-10 px-6 md:px-[100px] py-10 bg-[#f4f6f5]">
      
      {/* Left & Middle Section Wrapper */}
      <div className="flex flex-1 items-center justify-between w-full max-w-4xl">
        
        {/* 1. LfL Logo */}
        <div className="inline-flex flex-col items-start justify-center">
          <img 
            className="w-[163px] h-20 object-cover" 
            alt="Bayerische Landesanstalt für Landwirtschaft" 
            src="https://c.animaapp.com/mklwynogVVghMQ/img/bayerische-landesanstalt-fu-r-landwirtschaft-logo-svg-1-1.png" 
          />
        </div>

        {/* 2. Contact and Legal Info */}
        <div className="flex flex-col w-[326px] items-start justify-center gap-[15px]">
          
          {/* Contact Row */}
          <div className="flex items-center gap-2.5 text-sm font-['Roboto'] font-bold text-[#1e1e1e]">
            <p className="whitespace-nowrap">+49 (0) 8161 8640 4660</p>
            <div className="w-0.5 h-3 bg-white"></div>
            <a 
              href="mailto:NEULAND@lfl.bayern.de" 
              className="hover:underline transition-all"
            >
              NEULAND@lfl.bayern.de
            </a>
          </div>

          {/* Legal Links */}
          <div className="flex items-center gap-2.5 text-sm font-['Roboto'] font-normal text-[#1e1e1e]">
            {links.map((link, index) => (
              <React.Fragment key={link}>
                <a href="#" className="hover:text-green-700 transition-colors">
                  {link}
                </a>
                {index < links.length - 1 && (
                  <div className="w-0.5 h-3 bg-white"></div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* 3. StMELF Logo (Right side) */}
      <div className="inline-flex flex-col items-end justify-center">
        <img 
          className="w-[493px] h-[60px] object-cover" 
          alt="StMELF Logo" 
          src="https://c.animaapp.com/mklwynogVVghMQ/img/stmelf-logo-1-1.png" 
        />
      </div>
    </footer>
  );
};

export default Footer;