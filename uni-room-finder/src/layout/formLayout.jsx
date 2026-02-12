import React from 'react';
import QuestionList from '../components/questionList.jsx';
import Sidebar from '../components/sidebar.jsx';

const ForumLayout = ({ questions }) => {
  return (
    <div className="flex flex-col lg:flex-row w-full max-w-[1440px] mx-auto gap-10 px-4 py-10 items-start">
      
      {/* Left Column: The Feed (Wide) */}
      <div className="flex-1 min-w-0 lg:min-w-[800px]">
        <QuestionList questions={questions} />
      </div>

      {/* Right Column: The Sidebar (Fixed Width) */}
      <aside className="w-full lg:w-[380px] sticky top-10">
        <Sidebar />
      </aside>

    </div>
  );
};

export default ForumLayout;