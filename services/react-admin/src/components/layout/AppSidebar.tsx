import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Link, useLocation } from 'react-router-dom';

export default function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-bold tracking-tight text-foreground mb-4 mt-2">
            Audit Engine
          </SidebarGroupLabel>
          <SidebarGroupLabel className="text-sm font-semibold tracking-tight text-muted-foreground uppercase mb-1">
            Admin Recon
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link to="/" />} isActive={location.pathname === '/'}>
                  Audit Ledger
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link to="/risk" />} isActive={location.pathname === '/risk'}>
                  Supplier Risk
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-semibold tracking-tight text-muted-foreground uppercase mb-1">
            User Actions
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link to="/bookings/new" />} isActive={location.pathname === '/bookings/new'}>
                  Make Booking
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link to="/invoices/upload" />} isActive={location.pathname === '/invoices/upload'}>
                  Upload Invoices
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
