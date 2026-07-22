import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import AppSidebar from '@/components/layout/AppSidebar';

export default function Layout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background text-foreground transition-colors w-full">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 border-b">
            <SidebarTrigger />
          </div>
          <div className="p-8 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
