import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Render the main application
createRoot(document.getElementById("root")!).render(<App />);

// Add stagewise toolbar in development mode only
if (import.meta.env.DEV) {
  import('@stagewise/toolbar-react').then(({ StagewiseToolbar }) => {
    const stagewiseConfig = {
      plugins: []
    };

    // Create a separate root for the toolbar to avoid interfering with the main app
    const toolbarContainer = document.createElement('div');
    toolbarContainer.id = 'stagewise-toolbar-container';
    document.body.appendChild(toolbarContainer);
    
    createRoot(toolbarContainer).render(
      <StagewiseToolbar config={stagewiseConfig} />
    );
  });
}
