import React from 'react';
import Person from './profilecard.jsx'; 

const PostCard = ({ 
  authorName = "Johannes Leitner",
  authorRole = "Kleinlandwirt",
  location = "Garmisch-Partenkirchen, Bayern",
  timeAgo = "vor 2 Monaten",
  content = "Ich bewirtschafte einen kleinen Hof im Alpenvorland Bayerns und interessiere mich für traditionelle Anbaumethoden, die langfristig stabile Erträge sichern, auch angesichts veränderter Klimabedingungen. Welche alten oder regional angepassten Methoden funktionieren besonders gut, z. B. Mischkulturen, Fruchtfolgen oder...",
  tags = ["Traditionelle Anbaumethoden", "Regionale Landwirtschaft", "Selbstversorgung"],
  likes = "1,1 Tsd.",
  comments = 69
}) => {
  
  return (
    <div className="flex flex-col items-start w-full max-w-[1740px] gap-4 p-4 bg-white rounded-lg">
      
      {/* 1. Header Area */}
      <Person 
        name={authorName}
        role={authorRole}
        location={location}
        lastUpdated={timeAgo}
      />

      {/* 2. Content & Tags */}
      <div className="flex flex-col gap-4 w-full">
        <p className="text-[#1e1e1e] text-base leading-[25px] font-['Roboto'] font-normal">
          {content}
        </p>
        
        <div className="flex items-start gap-[15px] flex-wrap">
          {tags.map((tag, index) => (
            <div 
              key={index} 
              className="px-2.5 py-[5px] bg-[#e6e7dc] rounded-[5px] text-[#1f5f4a] text-sm font-normal font-['Roboto'] cursor-pointer hover:bg-[#d9dbcb] transition-colors"
            >
              {tag}
            </div>
          ))}
        </div>
      </div>

      {/* 3. Engagement (Likes & Comments) */}
      <div className="flex items-center gap-[15px] w-full h-[25px]">
        {/* Like */}
        <button className="inline-flex items-center gap-[5px] hover:opacity-70 transition-opacity">
          <p className="text-[#5f6f68] text-sm font-medium font-['Roboto']">
            Gefällt mir • {likes}
          </p>
          <img 
            src="https://c.animaapp.com/mklwynogVVghMQ/img/heart.svg" 
            alt="Heart" 
            className="w-[25px] h-[25px]" 
          />
        </button>

        {/* Comment */}
        <button className="inline-flex items-center gap-[5px] hover:opacity-70 transition-opacity">
          <p className="text-[#5f6f68] text-sm font-medium font-['Roboto']">
            Kommentare • {comments}
          </p>
          <img 
            src="https://c.animaapp.com/mklwynogVVghMQ/img/chat-multiple.svg" 
            alt="Comments" 
            className="w-[25px] h-[25px]" 
          />
        </button>
      </div>

      {/* 4. Action Button */}
      <div className="w-full mt-4">
        <button className="w-full py-2.5 border border-[#34b67a] text-[#34b67a] font-medium text-base rounded-[15px] hover:bg-[#34b67a] hover:text-white transition-all shadow-sm font-['Roboto'] uppercase tracking-wider">
          Weiterlesen
        </button>
      </div>

    </div>
  );
};

export default PostCard;