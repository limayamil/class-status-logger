import React from 'react';

const Footer: React.FC = () => {
  return (
    // Changed bg-gray-100 to bg-muted and text-gray-600 to text-muted-foreground
    <footer className="bg-muted py-4 mb-16 sm:mb-0 text-center text-muted-foreground text-sm mt-auto border-t border-border"> {/* Added border */}
      <div className="container mx-auto">
        Powered by <a href="https://potato-lab.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Potato lab</a> 🥔 2025 {/* Styled link */}
      </div>
    </footer>
  );
};

export default Footer;
