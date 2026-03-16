'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FileText, Send, Settings, Plus, Trash2, Edit, ExternalLink,
  Clock, CheckCircle, AlertCircle, Archive, Mail, Eye, Copy,
  ChevronRight, Sparkles, Zap, RefreshCw, Calendar, Tag,
  MoreHorizontal, Play, Pause, X, Save, Database, Cloud, CloudOff,
  Upload, Download, Link2, Check, AlertTriangle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'

// Types
interface Content {
  id: string
  title: string
  body: string
  type: 'NOTE' | 'POST'
  status: 'DRAFT' | 'READY_TO_PUBLISH' | 'PUBLISHED' | 'ARCHIVED'
  substackLink: string | null
  notionPageId: string | null
  emailSent: boolean
  emailSentAt: string | null
  tags: string | null
  wordCount: number
  scheduledAt: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  author?: { id: string; name: string | null; email: string }
}

interface PipelineStats {
  draft: number
  readyToPublish: number
  published: number
  archived: number
}

interface EmailCampaign {
  id: string
  subject: string
  sent: boolean
  sentAt: string | null
  recipientCount: number
  content?: { id: string; title: string }
}

interface NotionStatus {
  connected: boolean
  databaseId?: string
  databaseUrl?: string
  error?: string
}

// Sample content for demo
const SAMPLE_ARTICLE = `# Stop Telling Yourself What To Do. Start Mentoring Yourself Instead.

> *The mindset shift that changes how you grow — personally, spiritually, and in business.*

Most people talk to themselves all day long.

"Do this. Fix that. Why haven't you started yet?"

It sounds productive. But here's what's actually happening — you're commanding yourself like a task list. And task lists don't grow. They just get longer.

## The Real Difference

When you tell yourself what to do, you're the subject being commanded. Every slip becomes a failure. Every delay becomes evidence you're not enough.

When you mentor yourself, you're both the guide and the student.

> *"What if you stopped being your own boss... and became your own mentor?"*

## Jesus: The Ultimate Mentor

He didn't just give instructions. He walked alongside. He asked questions. He believed in people before they believed in themselves.

> *"Follow Me, and I will make you fishers of men."* — **Matthew 4:19**

**That is the heart of mentorship. Moving people from compliance to relationship. From duty to identity.**

---

*Want more content on faith, growth & breakthrough?*
**Follow @markytanky** — daily empowerment for your breakthrough journey.`

export default function ContentPipelineDashboard() {
  // State
  const [contents, setContents] = useState<Content[]>([])
  const [stats, setStats] = useState<PipelineStats>({ draft: 0, readyToPublish: 0, published: 0, archived: 0 })
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('pipeline')
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [selectedContent, setSelectedContent] = useState<Content | null>(null)
  
  // Form states
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [newType, setNewType] = useState<'NOTE' | 'POST'>('POST')
  const [newTags, setNewTags] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailRecipients, setEmailRecipients] = useState('')
  
  // Notion states
  const [notionStatus, setNotionStatus] = useState<NotionStatus>({ connected: false })
  const [syncing, setSyncing] = useState(false)

  // Fetch data
  const fetchData = async () => {
    setLoading(true)
    try {
      const [contentRes, pipelineRes, emailRes, notionRes] = await Promise.all([
        fetch('/api/content'),
        fetch('/api/pipeline'),
        fetch('/api/email'),
        fetch('/api/notion').catch(() => null)
      ])
      
      const contentData = await contentRes.json()
      const pipelineData = await pipelineRes.json()
      const emailData = await emailRes.json()
      
      if (contentData.success) setContents(contentData.data)
      if (pipelineData.success) setStats(pipelineData.data.stats)
      if (emailData.success) setCampaigns(emailData.data)
      
      if (notionRes) {
        const notionData = await notionRes.json()
        if (notionData?.success && notionData?.connected) {
          setNotionStatus({
            connected: true,
            databaseId: notionData.data?.id,
            databaseUrl: notionData.data?.url
          })
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  // Notion sync functions
  const createNotionDatabase = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/notion', { method: 'POST' })
      const data = await res.json()
      
      if (data.success) {
        setNotionStatus({
          connected: true,
          databaseId: data.data.id,
          databaseUrl: data.data.url
        })
        toast.success(data.created ? 'Database created in Notion!' : 'Database already exists')
      } else {
        toast.error(data.error || 'Failed to create database')
      }
    } catch (error) {
      toast.error('Failed to connect to Notion')
    } finally {
      setSyncing(false)
    }
  }

  const pushToNotion = async (contentId?: string) => {
    setSyncing(true)
    try {
      const res = await fetch('/api/notion/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contentId ? { contentId } : { syncAll: true })
      })
      const data = await res.json()
      
      if (data.success) {
        toast.success(data.message)
        fetchData()
      } else {
        toast.error(data.error || 'Sync failed')
      }
    } catch (error) {
      toast.error('Failed to sync with Notion')
    } finally {
      setSyncing(false)
    }
  }

  const pullFromNotion = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/notion/sync', { method: 'GET' })
      const data = await res.json()
      
      if (data.success) {
        toast.success(data.message)
        fetchData()
      } else {
        toast.error(data.error || 'Sync failed')
      }
    } catch (error) {
      toast.error('Failed to sync from Notion')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Content actions
  const createContent = async () => {
    if (!newTitle.trim()) {
      toast.error('Title is required')
      return
    }

    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          body: newBody,
          type: newType,
          tags: newTags
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Content created')
        setShowCreateModal(false)
        setNewTitle('')
        setNewBody('')
        setNewTags('')
        fetchData()
      } else {
        toast.error('Failed to create content')
      }
    } catch (error) {
      toast.error('Error creating content')
    }
  }

  const updateContentStatus = async (id: string, status: Content['status']) => {
    try {
      const res = await fetch(`/api/content/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })

      const data = await res.json()
      if (data.success) {
        toast.success(`Status updated to ${status.toLowerCase().replace('_', ' ')}`)
        fetchData()
      }
    } catch (error) {
      toast.error('Failed to update status')
    }
  }

  const publishContent = async (id: string) => {
    try {
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish', contentId: id })
      })

      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        fetchData()
      }
    } catch (error) {
      toast.error('Failed to publish')
    }
  }

  const deleteContent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this content?')) return

    try {
      const res = await fetch(`/api/content/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        toast.success('Content deleted')
        fetchData()
      }
    } catch (error) {
      toast.error('Failed to delete content')
    }
  }

  const sendEmail = async () => {
    if (!selectedContent || !emailSubject.trim()) {
      toast.error('Subject is required')
      return
    }

    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: selectedContent.id,
          subject: emailSubject,
          recipients: emailRecipients.split(',').map(e => e.trim()).filter(Boolean)
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        setShowEmailModal(false)
        setEmailSubject('')
        setEmailRecipients('')
        setSelectedContent(null)
        fetchData()
      }
    } catch (error) {
      toast.error('Failed to send email')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const loadSampleArticle = () => {
    setNewTitle('Stop Telling Yourself What To Do. Start Mentoring Yourself Instead.')
    setNewBody(SAMPLE_ARTICLE)
    setNewType('POST')
    setNewTags('mindset, faith, leadership, self-development')
  }

  // Status badge colors
  const getStatusColor = (status: Content['status']) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      case 'READY_TO_PUBLISH': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'PUBLISHED': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'ARCHIVED': return 'bg-red-500/20 text-red-400 border-red-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const getTypeColor = (type: Content['type']) => {
    return type === 'NOTE' 
      ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
  }

  // Calculate progress
  const totalContent = stats.draft + stats.readyToPublish + stats.published + stats.archived
  const pipelineProgress = totalContent > 0 ? Math.round((stats.published / totalContent) * 100) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-xl bg-black/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold">Content Pipeline</h1>
                <p className="text-xs text-zinc-500">Notion → n8n → Substack</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Notion Status */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-white/10">
                {notionStatus.connected ? (
                  <>
                    <Cloud className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-zinc-400">Notion</span>
                  </>
                ) : (
                  <>
                    <CloudOff className="w-4 h-4 text-zinc-500" />
                    <span className="text-xs text-zinc-500">Notion</span>
                  </>
                )}
              </div>
              
              <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowSettingsModal(true)}>
                <Settings className="w-4 h-4" />
              </Button>
              <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700">
                <Plus className="w-4 h-4 mr-2" />
                New Content
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-zinc-900/50 border-white/10 backdrop-blur">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-500/20 flex items-center justify-center">
                    <Edit className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.draft}</p>
                    <p className="text-xs text-zinc-500">Drafts</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-zinc-900/50 border-white/10 backdrop-blur">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.readyToPublish}</p>
                    <p className="text-xs text-zinc-500">Ready</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-zinc-900/50 border-white/10 backdrop-blur">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.published}</p>
                    <p className="text-xs text-zinc-500">Published</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-zinc-900/50 border-white/10 backdrop-blur">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{pipelineProgress}%</p>
                    <p className="text-xs text-zinc-500">Pipeline</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Pipeline Progress */}
        <Card className="bg-zinc-900/50 border-white/10 backdrop-blur mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Pipeline Progress</h3>
              <span className="text-sm text-zinc-500">{stats.published} of {totalContent} published</span>
            </div>
            <Progress value={pipelineProgress} className="h-2 bg-zinc-800 [&>div]:bg-gradient-to-r [&>div]:from-cyan-500 [&>div]:to-purple-600" />
          </CardContent>
        </Card>

        {/* Notion Integration Panel */}
        <Card className="bg-zinc-900/50 border-white/10 backdrop-blur mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${notionStatus.connected ? 'bg-green-500/20' : 'bg-zinc-800'}`}>
                  <Database className={`w-6 h-6 ${notionStatus.connected ? 'text-green-400' : 'text-zinc-500'}`} />
                </div>
                <div>
                  <h3 className="font-semibold">Notion Database</h3>
                  {notionStatus.connected ? (
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <Check className="w-3 h-3 text-green-400" />
                      <span>Connected</span>
                      {notionStatus.databaseUrl && (
                        <a href={notionStatus.databaseUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                          Open in Notion
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">Set up your content pipeline database</p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {!notionStatus.connected ? (
                  <Button onClick={createNotionDatabase} disabled={syncing} className="bg-gradient-to-r from-cyan-500 to-purple-600">
                    {syncing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
                    Create Database
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={pullFromNotion} disabled={syncing} className="border-white/10">
                      <Download className="w-4 h-4 mr-2" />
                      Pull
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => pushToNotion()} disabled={syncing} className="border-white/10">
                      <Upload className="w-4 h-4 mr-2" />
                      Push All
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-zinc-900/50 border border-white/10 mb-6">
            <TabsTrigger value="pipeline" className="data-[state=active]:bg-white/10">
              <FileText className="w-4 h-4 mr-2" />
              Pipeline
            </TabsTrigger>
            <TabsTrigger value="published" className="data-[state=active]:bg-white/10">
              <CheckCircle className="w-4 h-4 mr-2" />
              Published
            </TabsTrigger>
            <TabsTrigger value="email" className="data-[state=active]:bg-white/10">
              <Mail className="w-4 h-4 mr-2" />
              Email
            </TabsTrigger>
          </TabsList>

          {/* Pipeline Tab */}
          <TabsContent value="pipeline">
            <div className="grid gap-4">
              <AnimatePresence>
                {contents
                  .filter(c => c.status === 'DRAFT' || c.status === 'READY_TO_PUBLISH')
                  .map((content, index) => (
                    <motion.div
                      key={content.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="bg-zinc-900/50 border-white/10 backdrop-blur hover:border-white/20 transition-all">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className={getTypeColor(content.type)}>
                                  {content.type}
                                </Badge>
                                <Badge variant="outline" className={getStatusColor(content.status)}>
                                  {content.status.replace('_', ' ')}
                                </Badge>
                                {content.emailSent && (
                                  <Badge variant="outline" className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                                    <Mail className="w-3 h-3 mr-1" />
                                    Emailed
                                  </Badge>
                                )}
                                {content.notionPageId && (
                                  <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                                    <Link2 className="w-3 h-3 mr-1" />
                                    Notion
                                  </Badge>
                                )}
                              </div>
                              <h3 className="font-semibold text-lg mb-1 truncate">{content.title}</h3>
                              <p className="text-sm text-zinc-500 line-clamp-2">{content.body.slice(0, 150)}...</p>
                              <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                                <span>{content.wordCount} words</span>
                                <span>{new Date(content.createdAt).toLocaleDateString()}</span>
                                {content.tags && (
                                  <span className="flex items-center gap-1">
                                    <Tag className="w-3 h-3" />
                                    {content.tags}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" onClick={() => {
                                setSelectedContent(content)
                                setShowPreviewModal(true)
                              }}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-zinc-900 border-white/10">
                                  {content.status === 'DRAFT' && (
                                    <DropdownMenuItem onClick={() => updateContentStatus(content.id, 'READY_TO_PUBLISH')}>
                                      <Clock className="w-4 h-4 mr-2" />
                                      Mark Ready
                                    </DropdownMenuItem>
                                  )}
                                  {content.status === 'READY_TO_PUBLISH' && (
                                    <>
                                      <DropdownMenuItem onClick={() => publishContent(content.id)}>
                                        <Play className="w-4 h-4 mr-2" />
                                        Publish Now
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => updateContentStatus(content.id, 'DRAFT')}>
                                        <Pause className="w-4 h-4 mr-2" />
                                        Back to Draft
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedContent(content)
                                    setEmailSubject(content.title)
                                    setShowEmailModal(true)
                                  }}>
                                    <Mail className="w-4 h-4 mr-2" />
                                    Send Email
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => copyToClipboard(content.body)}>
                                    <Copy className="w-4 h-4 mr-2" />
                                    Copy Markdown
                                  </DropdownMenuItem>
                                  {notionStatus.connected && !content.notionPageId && (
                                    <DropdownMenuItem onClick={() => pushToNotion(content.id)}>
                                      <Upload className="w-4 h-4 mr-2" />
                                      Push to Notion
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => updateContentStatus(content.id, 'ARCHIVED')} className="text-yellow-500">
                                    <Archive className="w-4 h-4 mr-2" />
                                    Archive
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => deleteContent(content.id)} className="text-red-500">
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
              </AnimatePresence>

              {contents.filter(c => c.status === 'DRAFT' || c.status === 'READY_TO_PUBLISH').length === 0 && (
                <Card className="bg-zinc-900/50 border-white/10 border-dashed">
                  <CardContent className="p-12 text-center">
                    <FileText className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No content in pipeline</h3>
                    <p className="text-zinc-500 mb-4">Create your first piece of content to get started</p>
                    <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-cyan-500 to-purple-600">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Content
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Published Tab */}
          <TabsContent value="published">
            <div className="grid gap-4">
              {contents
                .filter(c => c.status === 'PUBLISHED')
                .map((content, index) => (
                  <motion.div
                    key={content.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="bg-zinc-900/50 border-white/10 backdrop-blur">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className={getTypeColor(content.type)}>
                                {content.type}
                              </Badge>
                              <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                                Published
                              </Badge>
                            </div>
                            <h3 className="font-semibold text-lg mb-1">{content.title}</h3>
                            <p className="text-sm text-zinc-500">{content.wordCount} words • Published {content.publishedAt ? new Date(content.publishedAt).toLocaleDateString() : 'N/A'}</p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {content.substackLink && (
                              <Button variant="ghost" size="sm" asChild>
                                <a href={content.substackLink} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(content.body)}>
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              
              {contents.filter(c => c.status === 'PUBLISHED').length === 0 && (
                <Card className="bg-zinc-900/50 border-white/10 border-dashed">
                  <CardContent className="p-12 text-center">
                    <CheckCircle className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No published content yet</h3>
                    <p className="text-zinc-500">Published content will appear here</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Email Tab */}
          <TabsContent value="email">
            <div className="grid gap-4">
              {campaigns.map((campaign, index) => (
                <motion.div
                  key={campaign.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="bg-zinc-900/50 border-white/10 backdrop-blur">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className={campaign.sent ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"}>
                              {campaign.sent ? 'Sent' : 'Pending'}
                            </Badge>
                            <span className="text-xs text-zinc-500">
                              {campaign.recipientCount} recipient{campaign.recipientCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <h3 className="font-semibold">{campaign.subject}</h3>
                          {campaign.content && (
                            <p className="text-sm text-zinc-500 mt-1">From: {campaign.content.title}</p>
                          )}
                          {campaign.sentAt && (
                            <p className="text-xs text-zinc-500 mt-2">Sent {new Date(campaign.sentAt).toLocaleString()}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
              
              {campaigns.length === 0 && (
                <Card className="bg-zinc-900/50 border-white/10 border-dashed">
                  <CardContent className="p-12 text-center">
                    <Mail className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No email campaigns yet</h3>
                    <p className="text-zinc-500">Send emails from the pipeline to see them here</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-zinc-900 border-white/10">
          <DialogHeader>
            <DialogTitle>Create New Content</DialogTitle>
            <DialogDescription>Add content to your pipeline</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex gap-2 mb-4">
              <Button variant="outline" size="sm" onClick={loadSampleArticle} className="border-white/10">
                <Sparkles className="w-4 h-4 mr-2" />
                Load Sample Article
              </Button>
            </div>
            
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Enter title..."
                className="bg-zinc-800 border-white/10"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={newType} onValueChange={(v: 'NOTE' | 'POST') => setNewType(v)}>
                  <SelectTrigger className="bg-zinc-800 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-white/10">
                    <SelectItem value="POST">Post (Long-form)</SelectItem>
                    <SelectItem value="NOTE">Note (Short-form)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Tags</Label>
                <Input
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="tag1, tag2, tag3"
                  className="bg-zinc-800 border-white/10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Body (Markdown)</Label>
              <Textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Write your content in markdown..."
                className="min-h-[300px] bg-zinc-800 border-white/10 font-mono text-sm"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={createContent} className="bg-gradient-to-r from-cyan-500 to-purple-600">
              <Save className="w-4 h-4 mr-2" />
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-zinc-900 border-white/10">
          <DialogHeader>
            <DialogTitle>{selectedContent?.title}</DialogTitle>
            <DialogDescription>
              {selectedContent?.wordCount} words • {selectedContent?.type} • {selectedContent?.status.replace('_', ' ')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="prose prose-invert prose-sm max-w-none py-4">
            {selectedContent && (
              <ReactMarkdown>{selectedContent.body}</ReactMarkdown>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowPreviewModal(false)}>Close</Button>
            {selectedContent?.status === 'READY_TO_PUBLISH' && (
              <Button onClick={() => {
                if (selectedContent) publishContent(selectedContent.id)
                setShowPreviewModal(false)
              }} className="bg-gradient-to-r from-cyan-500 to-purple-600">
                <Play className="w-4 h-4 mr-2" />
                Publish
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Modal */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="bg-zinc-900 border-white/10">
          <DialogHeader>
            <DialogTitle>Send Email Campaign</DialogTitle>
            <DialogDescription>Send content as email newsletter</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Email subject..."
                className="bg-zinc-800 border-white/10"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Recipients (comma-separated)</Label>
              <Input
                value={emailRecipients}
                onChange={(e) => setEmailRecipients(e.target.value)}
                placeholder="email1@example.com, email2@example.com"
                className="bg-zinc-800 border-white/10"
              />
            </div>
            
            {selectedContent && (
              <div className="p-3 bg-zinc-800/50 rounded-lg">
                <p className="text-sm text-zinc-400">Content:</p>
                <p className="font-medium">{selectedContent.title}</p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEmailModal(false)}>Cancel</Button>
            <Button onClick={sendEmail} className="bg-gradient-to-r from-cyan-500 to-purple-600">
              <Send className="w-4 h-4 mr-2" />
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Modal */}
      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent className="bg-zinc-900 border-white/10">
          <DialogHeader>
            <DialogTitle>Pipeline Settings</DialogTitle>
            <DialogDescription>Configure your automation integrations</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Notion Integration
              </h4>
              <div className="grid gap-3 pl-6">
                <div className="space-y-2">
                  <Label className="text-xs text-zinc-500">API Key</Label>
                  <Input type="password" placeholder="secret_..." className="bg-zinc-800 border-white/10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-zinc-500">Database ID</Label>
                  <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="bg-zinc-800 border-white/10" />
                </div>
              </div>
            </div>
            
            <Separator className="bg-white/10" />
            
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Substack Integration
              </h4>
              <div className="grid gap-3 pl-6">
                <div className="space-y-2">
                  <Label className="text-xs text-zinc-500">Publication Name</Label>
                  <Input placeholder="markytanky" className="bg-zinc-800 border-white/10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-zinc-500">API Key</Label>
                  <Input type="password" placeholder="..." className="bg-zinc-800 border-white/10" />
                </div>
              </div>
            </div>
            
            <Separator className="bg-white/10" />
            
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Settings
              </h4>
              <div className="grid gap-3 pl-6">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-zinc-500">Auto-send on publish</Label>
                  <Switch />
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSettingsModal(false)}>Cancel</Button>
            <Button onClick={() => {
              toast.success('Settings saved')
              setShowSettingsModal(false)
            }} className="bg-gradient-to-r from-cyan-500 to-purple-600">
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
