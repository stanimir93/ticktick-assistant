import { Routes, Route } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import ChatPage from '@/pages/ChatPage';
import SettingsPage from '@/pages/SettingsPage';

export default function App() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/chat/:conversationId" element={<ChatPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </SidebarInset>
    </SidebarProvider>
  );
}
