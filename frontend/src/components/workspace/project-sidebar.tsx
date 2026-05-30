'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import {
  AudioLines,
  Hash,
  Layout,
  ListTodo,
  NotebookPen,
  Plus,
  Target,
  FolderKanban,
  Bird,
  Settings,
  MoreHorizontal,
  Globe,
  Lock,
  Trash2,
  Check,
  X,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  useChannelProjects,
  useCreateProject,
  useProjectGroups,
  useProject,
  useUpdateProject,
  useDeleteProject,
  useProjectJoinRequests,
  useRespondToProjectJoinRequest,
  useProjectMembers,
  useRequestJoinProject,
  useJoinProject,
} from '@/hooks/use-projects';
import { useChannels } from '@/hooks/use-channels';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { UserAvatar } from '@/components/chat/user-avatar';
import { useState, useEffect } from 'react';
import { backendGroupToMock } from '@/hooks/use-groups';
import { useProfile } from '@/hooks/use-user';
import { useRouter } from 'next/navigation';
import { ChannelSettingsSheet, type WorkspaceChannel } from '@/components/chat/channel-settings-sheet';

const TOOLS = [
  { slug: 'notes', label: 'Notes', icon: NotebookPen },
  { slug: 'tasks', label: 'Tasks', icon: ListTodo },
  { slug: 'goals', label: 'Goals', icon: Target },
  { slug: 'whiteboards', label: 'Whiteboards', icon: Layout },
] as const;

function groupIcon(type: string) {
  if (type === 'voice') return AudioLines;
  if (type === 'board') return Bird;
  return Hash;
}

function ProjectSettingsSheet({
  channelId,
  projectId,
  open,
  onOpenChange,
}: {
  channelId: string;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: project } = useProject(channelId, projectId);
  const updateProject = useUpdateProject(channelId, projectId);
  const deleteProject = useDeleteProject(channelId, projectId);
  const { data: joinRequests = [] } = useProjectJoinRequests(projectId);
  const respondToRequest = useRespondToProjectJoinRequest(projectId);
  const { data: members = [] } = useProjectMembers(projectId);
  const { data: profile } = useProfile();
  const router = useRouter();

  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [accessType, setAccessType] = useState<'PUBLIC' | 'PRIVATE'>(project?.access_type ?? 'PUBLIC');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  if (!project) return null;

  const isAdmin = project.role === 'OWNER' || project.role === 'ADMIN';

  const handleSave = async () => {
    try {
      await updateProject.mutateAsync({
        name,
        description,
        access_type: accessType,
      });
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to update project:', err);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteProject.mutateAsync();
      onOpenChange(false);
      router.push(`/channels/${channelId}`);
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] p-0 sm:w-[440px]">
        <SheetHeader className="p-6 pb-0">
          <SheetTitle className="text-[16px] font-bold">Project Settings</SheetTitle>
        </SheetHeader>

        <div className="h-[calc(100vh-80px)] overflow-y-auto pb-10">
          {/* General Settings */}
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px]">Project name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 rounded-xl text-[12px]"
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[72px] rounded-xl text-[12px] leading-5"
                disabled={!isAdmin}
              />
            </div>
          </div>

          {/* Access */}
          <div className="p-6 pt-0 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Access
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['PUBLIC', 'PRIVATE'] as const).map((vis) => (
                <button
                  key={vis}
                  disabled={!isAdmin}
                  onClick={() => setAccessType(vis)}
                  className={cn(
                    'flex flex-col items-start gap-1.5 rounded-2xl border p-3 text-left transition-colors',
                    accessType === vis
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent',
                    !isAdmin && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {vis === 'PUBLIC' ? (
                    <Globe className="h-4 w-4 text-primary" />
                  ) : (
                    <Lock className="h-4 w-4 text-primary" />
                  )}
                  <span className="text-[11px] font-semibold capitalize text-foreground">{vis.toLowerCase()}</span>
                  <span className="text-[10px] leading-4 text-muted-foreground">
                    {vis === 'PUBLIC' ? 'Channel members can join' : 'Invite-only access'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Join Requests */}
          {isAdmin && accessType === 'PRIVATE' && (
            <div className="p-6 pt-0 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Join Requests
                </p>
                {joinRequests.length > 0 && (
                  <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {joinRequests.length}
                  </span>
                )}
              </div>
              {joinRequests.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No pending requests</p>
              ) : (
                <div className="space-y-2">
                  {joinRequests.map((req) => (
                    <div key={req.id} className="flex items-center gap-2.5 rounded-2xl border border-border bg-muted/30 px-3 py-2.5">
                      <UserAvatar src={req.user?.avatar_url} alt={req.user?.username ?? ''} className="h-7 w-7 shrink-0 rounded-full" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-semibold text-foreground">{req.user?.username}</p>
                        <p className="text-[9px] text-muted-foreground">Requested to join</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-600"
                          onClick={() => respondToRequest.mutate({ requestId: req.id, action: 'ACCEPT' })}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => respondToRequest.mutate({ requestId: req.id, action: 'REJECT' })}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Members */}
          <div className="p-6 pt-0 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Members ({members.length})
            </p>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.user.id} className="flex items-center gap-2.5 px-1">
                  <UserAvatar src={m.user.avatar_url} alt={m.user.username ?? ''} className="h-7 w-7 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-foreground">{m.user.username}</p>
                    <p className="text-[9px] text-muted-foreground capitalize">{m.role.toLowerCase()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {isAdmin && (
            <div className="p-6 pt-0 space-y-4">
              <Separator />
              <div className="flex flex-col gap-2">
                <Button
                  className="w-full justify-start rounded-xl text-[12px] font-semibold"
                  onClick={handleSave}
                  disabled={updateProject.isPending}
                >
                  Save changes
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start rounded-xl text-[12px] font-semibold text-destructive hover:bg-destructive/5 hover:text-destructive"
                  onClick={() => setDeleteConfirm(true)}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete project
                </Button>
              </div>
            </div>
          )}
        </div>

        <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
          <DialogContent className="sm:max-w-[360px]">
            <DialogHeader>
              <DialogTitle className="text-[15px] font-bold">Delete Project?</DialogTitle>
            </DialogHeader>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              This will permanently delete <span className="font-semibold text-foreground">{project.name}</span> and all its data (notes, tasks, whiteboards, etc.). This action cannot be undone.
            </p>
            <DialogFooter className="mt-4 flex gap-2 sm:justify-end">
              <Button variant="ghost" className="rounded-xl text-[12px]" onClick={() => setDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" className="rounded-xl text-[12px]" onClick={handleDelete} disabled={deleteProject.isPending}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}

export function ProjectSidebar() {
  const { channelId, projectId } = useParams<{ channelId: string; projectId: string }>();
  const pathname = usePathname();
  const { data: channels = [] } = useChannels();
  const channel = channels.find((c) => c.id === channelId);
  const { data: projects = [] } = useChannelProjects(channelId);
  const { data: currentProject } = useProject(channelId, projectId);
  const { data: groups = [] } = useProjectGroups(channelId, projectId);
  const createProject = useCreateProject(channelId);
  const requestJoin = useRequestJoinProject();
  const joinProject = useJoinProject();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [channelSettingsOpen, setChannelSettingsOpen] = useState(false);
  const [name, setName] = useState('');

  const hasProject = Boolean(projectId);
  const base = hasProject ? `/channels/${channelId}/projects/${projectId}` : null;
  const isAdmin = currentProject?.role === 'OWNER' || currentProject?.role === 'ADMIN';
  const canManageChannel = channel?.role === 'OWNER' || channel?.role === 'ADMIN';

  const onSettingsOpenChange = (open: boolean) => {
    setSettingsOpen(open);
    if (!open) {
      setEditingProjectId(null);
    }
  };

  const workspaceChannel: WorkspaceChannel | undefined = channel ? {
    id: channel.id,
    label: channel.name,
    description: channel.description ?? '',
    avatarUrl: channel.avatar_url ?? undefined,
    bannerUrl: channel.banner_url ?? undefined,
    access_type: channel.access_type as any,
    role: channel.role as any,
    owner_id: channel.owner_id,
    type: 'WORKSPACE',
  } : undefined;

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="border-b border-border px-3 py-3 flex items-center justify-between group/header">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Workspace
          </p>
          <p className="truncate text-[13px] font-semibold text-foreground">{channel?.name}</p>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover/header:opacity-100 transition-opacity">
          {canManageChannel && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg shrink-0"
              onClick={() => setChannelSettingsOpen(true)}
              title="Workspace settings"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          )}
          {hasProject && isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg shrink-0"
              onClick={() => {
                setEditingProjectId(projectId);
                setSettingsOpen(true);
              }}
              title="Project settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Projects
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="space-y-0.5">
          {projects.map((p) => {
            const isMember = !!p.role;
            const isProjectAdmin = p.role === 'OWNER' || p.role === 'ADMIN';

            if (!isMember) {
              return (
                <div
                  key={p.id}
                  className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{p.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] font-bold opacity-0 group-hover:opacity-100"
                    onClick={() => {
                      if (p.access_type === 'PUBLIC') {
                        joinProject.mutate(p.id);
                      } else {
                        requestJoin.mutate(p.id);
                      }
                    }}
                    disabled={requestJoin.isPending || joinProject.isPending}
                  >
                    {p.access_type === 'PUBLIC' ? 'Join' : 'Request'}
                  </Button>
                </div>
              );
            }

            return (
              <div key={p.id} className="group relative">
                <Link
                  href={`/channels/${channelId}/projects/${p.id}/notes`}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] transition-colors pr-8',
                    p.id === projectId
                      ? 'bg-primary/10 font-semibold text-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{p.name}</span>
                </Link>
                {isProjectAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingProjectId(p.id);
                      onSettingsOpenChange(true);
                    }}
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>


        {hasProject && base ? (
          <>
            <p className="mb-2 mt-4 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tools
            </p>
            <div className="space-y-0.5">
              {TOOLS.map(({ slug, label, icon: Icon }) => {
                const href = `${base}/${slug}`;
                const active = pathname.includes(`/${slug}`);
                return (
                  <Link
                    key={slug}
                    href={href}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] transition-colors',
                      active
                        ? 'bg-primary/10 font-semibold text-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </Link>
                );
              })}
            </div>

            <p className="mb-2 mt-4 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Groups
            </p>
            <div className="space-y-0.5">
              {groups.map((g) => {
                const mock = backendGroupToMock(g);
                const Icon = groupIcon(mock.kind);
                const href = `${base}/group/${g.id}`;
                const active = pathname.includes(`/group/${g.id}`);
                return (
                  <Link
                    key={g.id}
                    href={href}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] transition-colors',
                      active
                        ? 'bg-primary/10 font-semibold text-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="truncate">{g.name}</span>
                  </Link>
                );
              })}
            </div>
          </>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <DialogFooter>
            <Button
              disabled={!name.trim() || createProject.isPending}
              onClick={async () => {
                await createProject.mutateAsync({ name: name.trim(), access_type: 'PUBLIC' });
                setName('');
                setOpen(false);
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingProjectId && (
        <ProjectSettingsSheet
          channelId={channelId}
          projectId={editingProjectId}
          open={settingsOpen}
          onOpenChange={onSettingsOpenChange}
        />
      )}

      {workspaceChannel && (
        <ChannelSettingsSheet
          channel={workspaceChannel}
          open={channelSettingsOpen}
          onOpenChange={setChannelSettingsOpen}
        />
      )}
    </aside>
  );
}
