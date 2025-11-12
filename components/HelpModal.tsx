import React from 'react';
import { CloseIcon } from './Icons';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const formattingOptions = [
  { style: 'Bold', syntax: '**bold** or __bold__', example: <strong className="text-gray-900">bold</strong> },
  { style: 'Italic', syntax: '*italic* or _italic_', example: <em className="text-gray-900">italic</em> },
  { style: 'Bold + Italic', syntax: '***bold italic***', example: <strong className="text-gray-900"><em>bold italic</em></strong> },
  { style: 'Strikethrough', syntax: '~~strikethrough~~', example: <s className="text-gray-900">strikethrough</s> },
  { style: 'Inline code', syntax: '`code`', example: <code className="bg-gray-200 text-red-600 px-1 py-0.5 rounded text-xs">code</code> },
  { style: 'Block code', syntax: '```\ncode block\n```', example: <pre className="bg-gray-800 text-white p-2 rounded text-xs mt-1 w-max"><code>code block</code></pre> },
  { style: 'Quote', syntax: '> quote', example: <blockquote className="border-l-4 border-gray-300 pl-2 text-gray-600 italic">quote</blockquote> },
  { style: 'Lists', syntax: '- item\n1. item', example: <ul className="list-inside"><li className="list-disc">item</li><li className="list-decimal">item</li></ul> },
  { style: 'Links', syntax: '[text](url)', example: <a href="#" onClick={(e) => e.preventDefault()} className="text-blue-600 underline">text</a> },
  { style: 'Image', syntax: '![alt text](image_url)', example: <span className="text-gray-500">🖼️ image</span> },
];

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 transition-opacity"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 p-6 transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Text Formatting Guide</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
            aria-label="Close help modal"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Style</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Syntax</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Example</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {formattingOptions.map((item, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.style}</td>
                  <td className="px-6 py-4 whitespace-pre-wrap text-sm text-gray-500 font-mono"><code>{item.syntax}</code></td>
                  <td className="px-6 py-4 text-sm text-gray-500">{item.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
