
import StreamingHeader from './StreamingHeader';
import DesktopAppHeader from './DesktopAppHeader';
import { useDesktopApp } from '../hooks/use-desktop-app';

const Header = () => {
  const { isDesktopApp } = useDesktopApp();
  
  return isDesktopApp ? <DesktopAppHeader /> : <StreamingHeader />;
};

export default Header;
