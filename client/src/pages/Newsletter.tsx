import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Plus, Send, Eye, Trash2, Users, Mail, UserCheck, UserX } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";

export default function Newsletter() {
  const [activeTab, setActiveTab] = useState("campaigns");

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Newsletter Management</h1>
        <p className="text-muted-foreground">Manage campaigns and contacts</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-8">
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <CampaignsTab />
        </TabsContent>

        <TabsContent value="contacts">
          <ContactsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============= CAMPAIGNS TAB =============
function CampaignsTab() {
  const campaigns = useQuery(api.newsletter.getAllCampaigns, {});
  const emailTemplates = useQuery(api.emailTemplates.getAll);
  const createCampaign = useMutation(api.newsletter.createCampaign);
  const sendCampaign = useMutation(api.newsletter.sendCampaign);
  const deleteCampaign = useMutation(api.newsletter.deleteCampaign);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    subject: "",
    templateName: "",
    description: "",
    targetTags: "",
    targetSource: "all" as "waitlist" | "user" | "all",
    testMode: true,
  });

  const handleCreateCampaign = async () => {
    try {
      await createCampaign({
        name: newCampaign.name,
        subject: newCampaign.subject,
        templateName: newCampaign.templateName,
        description: newCampaign.description || undefined,
        targetTags: newCampaign.targetTags ? newCampaign.targetTags.split(",").map(t => t.trim()) : undefined,
        targetSource: newCampaign.targetSource !== "all" ? newCampaign.targetSource : undefined,
        testMode: newCampaign.testMode,
      });
      toast.success("Campaign created successfully");
      setIsCreateDialogOpen(false);
      setNewCampaign({
        name: "",
        subject: "",
        templateName: "",
        description: "",
        targetTags: "",
        targetSource: "all",
        testMode: true,
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to create campaign");
    }
  };

  const handleSendCampaign = async (campaignId: string) => {
    if (!confirm("Are you sure you want to send this campaign?")) return;

    try {
      const result = await sendCampaign({ campaignId: campaignId as any });
      toast.success(`Campaign scheduled! Sending to ${result.totalRecipients} recipients in ${result.batches} batches`);
    } catch (error: any) {
      toast.error(error.message || "Failed to send campaign");
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;

    try {
      await deleteCampaign({ campaignId: campaignId as any });
      toast.success("Campaign deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete campaign");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      scheduled: "outline",
      sending: "default",
      sent: "default",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  if (!campaigns || !emailTemplates) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Email Campaigns</h2>
          <p className="text-muted-foreground">Create and manage newsletter campaigns</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Campaign</DialogTitle>
              <DialogDescription>
                Create a new newsletter campaign to send to your contacts
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Campaign Name</Label>
                <Input
                  id="name"
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  placeholder="Beta Launch Announcement"
                />
              </div>
              <div>
                <Label htmlFor="subject">Email Subject</Label>
                <Input
                  id="subject"
                  value={newCampaign.subject}
                  onChange={(e) => setNewCampaign({ ...newCampaign, subject: e.target.value })}
                  placeholder="Welcome to Serbian AI Tutor Beta!"
                />
              </div>
              <div>
                <Label htmlFor="template">Email Template</Label>
                <Select
                  value={newCampaign.templateName}
                  onValueChange={(value) => setNewCampaign({ ...newCampaign, templateName: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    {emailTemplates
                      .filter((t) => t.isActive)
                      .map((template) => (
                        <SelectItem key={template._id} value={template.name}>
                          {template.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={newCampaign.description}
                  onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                  placeholder="Internal notes about this campaign"
                />
              </div>
              <div>
                <Label htmlFor="targetTags">Target Tags (comma-separated, optional)</Label>
                <Input
                  id="targetTags"
                  value={newCampaign.targetTags}
                  onChange={(e) => setNewCampaign({ ...newCampaign, targetTags: e.target.value })}
                  placeholder="waitlist, beta-user"
                />
              </div>
              <div>
                <Label htmlFor="targetSource">Target Source</Label>
                <Select
                  value={newCampaign.targetSource}
                  onValueChange={(value: any) => setNewCampaign({ ...newCampaign, targetSource: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Contacts</SelectItem>
                    <SelectItem value="waitlist">Waitlist Only</SelectItem>
                    <SelectItem value="user">Users Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="testMode"
                  checked={newCampaign.testMode}
                  onChange={(e) => setNewCampaign({ ...newCampaign, testMode: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="testMode" className="cursor-pointer">
                  Test Mode (send only to whitelist)
                </Label>
              </div>
              <Button onClick={handleCreateCampaign} className="w-full">
                Create Campaign
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {campaigns.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No campaigns yet. Create your first campaign!</p>
            </CardContent>
          </Card>
        ) : (
          campaigns.map((campaign) => (
            <Card key={campaign._id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {campaign.name}
                      {getStatusBadge(campaign.status)}
                      {campaign.testMode && <Badge variant="outline">Test Mode</Badge>}
                    </CardTitle>
                    <CardDescription>{campaign.subject}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {campaign.status === "draft" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSendCampaign(campaign._id)}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Send
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteCampaign(campaign._id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {campaign.status === "sent" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.location.href = `/admin/newsletter-analytics?campaign=${campaign._id}`}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Stats
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Template</p>
                    <p className="font-medium">{campaign.templateName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Recipients</p>
                    <p className="font-medium">{campaign.totalRecipients || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Sent</p>
                    <p className="font-medium">{campaign.sentCount || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Created</p>
                    <p className="font-medium">{new Date(campaign.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                {campaign.description && (
                  <p className="text-sm text-muted-foreground mt-4">{campaign.description}</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ============= CONTACTS TAB =============
function ContactsTab() {
  const allContacts = useQuery(api.newsletter.getAllContacts, {});
  const stats = useQuery(api.newsletter.getNewsletterStats);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterSubscribed, setFilterSubscribed] = useState<"all" | "subscribed" | "unsubscribed">("all");
  const [filterSource, setFilterSource] = useState<"all" | "waitlist" | "user" | "manual">("all");

  if (!allContacts || !stats) {
    return <div className="p-8">Loading...</div>;
  }

  const filteredContacts = allContacts.filter((contact) => {
    if (searchTerm && !contact.email.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterSubscribed === "subscribed" && !contact.subscribed) {
      return false;
    }
    if (filterSubscribed === "unsubscribed" && contact.subscribed) {
      return false;
    }
    if (filterSource !== "all" && contact.source !== filterSource) {
      return false;
    }
    return true;
  });

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Newsletter Contacts</h2>
        <p className="text-muted-foreground">View and manage your subscriber list</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalContacts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscribed</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.subscribed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unsubscribed</CardTitle>
            <UserX className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unsubscribed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">From Waitlist</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sources.waitlist}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Input
                placeholder="Search by email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Select value={filterSubscribed} onValueChange={(value: any) => setFilterSubscribed(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contacts</SelectItem>
                  <SelectItem value="subscribed">Subscribed Only</SelectItem>
                  <SelectItem value="unsubscribed">Unsubscribed Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={filterSource} onValueChange={(value: any) => setFilterSource(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="waitlist">Waitlist</SelectItem>
                  <SelectItem value="user">Users</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contacts List */}
      <Card>
        <CardHeader>
          <CardTitle>Contacts ({filteredContacts.length})</CardTitle>
          <CardDescription>
            {filterSubscribed === "subscribed" && "Showing subscribed contacts"}
            {filterSubscribed === "unsubscribed" && "Showing unsubscribed contacts"}
            {filterSubscribed === "all" && "Showing all contacts"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredContacts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No contacts found</p>
            ) : (
              filteredContacts.map((contact) => (
                <div
                  key={contact._id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{contact.email}</p>
                      {contact.subscribed ? (
                        <Badge variant="default" className="bg-green-600">Subscribed</Badge>
                      ) : (
                        <Badge variant="secondary">Unsubscribed</Badge>
                      )}
                      <Badge variant="outline">{contact.source}</Badge>
                    </div>
                    {contact.name && (
                      <p className="text-sm text-muted-foreground">{contact.name}</p>
                    )}
                    {contact.tags.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {contact.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {contact.subscribed ? (
                      <span>Subscribed {new Date(contact.subscribedAt).toLocaleDateString()}</span>
                    ) : (
                      contact.unsubscribedAt && (
                        <span>Unsubscribed {new Date(contact.unsubscribedAt).toLocaleDateString()}</span>
                      )
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
