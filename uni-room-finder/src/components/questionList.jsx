import React from 'react';
import PostCard from './commentcard.jsx';

const QuestionList = ({ questions }) => {
  return (
    <div className="flex flex-col items-start gap-5 p-8 bg-white rounded-lg shadow-md border border-gray-200 w-full ">
      
      {/* Header of the List */}
      <div className="w-full">
        <h2 className="text-gray-900 text-lg font-semibold font-['Roboto'] leading-[30px]">
          Interessante Fragen für dich
        </h2>
        <div className="w-full h-px bg-gray-300 mt-2"></div>
      </div>

      {/* The Loop: Renders a card for every item in the list */}
      <div className="flex flex-col w-full gap-2">
        {questions.map((q) => (
          <PostCard 
            key={q.id}
            authorName={q.name}
            authorRole={q.role}
            location={q.location}
            timeAgo={q.timeAgo}
            content={q.content}
            tags={q.tags}
            likes={q.likes}
            comments={q.comments}
            showReadMore={true} 
          />
        ))}
      </div>
    </div>
  );
};

export default QuestionList;