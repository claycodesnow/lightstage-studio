import { useStore } from './store';
import { Home } from './ui/Home';
import { Editor } from './ui/Editor';

export default function App() {
  const screen = useStore((s) => s.screen);
  const toast = useStore((s) => s.toast);
  return (
    <>
      {screen === 'home' ? <Home /> : <Editor />}
      {screen === 'home' && toast && <div className="toast">{toast}</div>}
    </>
  );
}
