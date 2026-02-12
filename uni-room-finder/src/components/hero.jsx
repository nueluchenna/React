import React from 'react';
import Breadcrumb from './Breadcrumb';

const HeroSection = ({ 
  title = "COMMUNITY-FORUM", 
  subtitle = "Hier treffen sich Hobbygärtner, Landwirte und Naturbegeisterte" 
}) => {
  return (
    <div className="flex flex-col gap-6 pb-20">
        <Breadcrumb />

        <div className="w-full flex flex-col items-center justify-center gap-4 py-10 px-4">
        {/* Main Title */}
        <h1 className="font-['Roboto'] font-bold text-gray-900 text-4xl md:text-[40px] text-center uppercase leading-tight tracking-tight">
            {title}
        </h1>
        
        {/* Subtitle */}
        <p className="font-['Roboto'] font-normal text-gray-700 text-lg md:text-xl text-center leading-relaxed max-w-2xl">
            {subtitle}
        </p>
        </div>
    </div>

        
  );
};

export default HeroSection;