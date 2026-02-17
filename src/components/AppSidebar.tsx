import { useMatch, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';

import { db, type Conversation } from '@/lib/db';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  MessageSquarePlus,
  Settings,
  Trash2,
  X,
  MessageSquare,
} from 'lucide-react';

export function AppSidebar() {
  const chatMatch = useMatch('/chat/:conversationId');
  const activeConversationId = chatMatch?.params.conversationId;
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  const conversations = useLiveQuery(() =>
    db.conversations.orderBy('updatedAt').reverse().toArray()
  );

  const handleSelect = (conv: Conversation) => {
    navigate(`/chat/${conv.id}`);
    if (isMobile) setOpenMobile(false);
  };

  const handleNewChat = () => {
    navigate('/');
    if (isMobile) setOpenMobile(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await db.conversations.delete(id);
    if (id === activeConversationId) {
      navigate('/');
    }
  };

  const handleClearAll = async () => {
    await db.conversations.clear();
    navigate('/');
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" onClick={handleNewChat}>
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <MessageSquare className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">TickTick Assistant</span>
                <span className="text-xs text-sidebar-foreground/70">
                  AI Task Manager
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            Chat History
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleNewChat} className="justify-between">
                  <span className="flex items-center gap-2">
                    <MessageSquarePlus className="size-4" />
                    <span>New Chat</span>
                  </span>
                  <kbd className="text-[10px] text-muted-foreground">
                    {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl+'}J
                  </kbd>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {conversations?.map((conv) => (
                <SidebarMenuItem key={conv.id}>
                  <SidebarMenuButton
                    isActive={conv.id === activeConversationId}
                    onClick={() => handleSelect(conv)}
                    tooltip={conv.title || 'New conversation'}
                  >
                    <span className="truncate">
                      {conv.title || 'New conversation'}
                    </span>
                  </SidebarMenuButton>
                  <SidebarMenuAction
                    onClick={(e) => handleDelete(e, conv.id)}
                    showOnHover
                    title="Delete conversation"
                  >
                    <X className="size-4" />
                    <span className="sr-only">Delete</span>
                  </SidebarMenuAction>
                </SidebarMenuItem>
              ))}
              {conversations?.length === 0 && (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                  No conversations yet
                </p>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          {conversations && conversations.length > 0 && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleClearAll}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
                <span>Clear All History</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/settings">
                <Settings className="size-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
