"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, Plus, Settings, LogOut } from "lucide-react"
import UploadDropzone from "@/components/upload-dropzone"
import AddLinkForm from "@/components/add-link-form"
import ChatPanel from "@/components/chat-panel"
import ApiKeyManager from "@/components/api-key-manager"
import { signOut } from "@/lib/actions"

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("upload")

  const handleUploadComplete = () => {
    // Refresh or update bookmark list if needed
    console.log("Upload completed")
  }

  const handleLinkAdded = () => {
    // Refresh or update bookmark list if needed
    console.log("Link added")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-[#000080]">AI Bookmark Organizer</h1>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab("settings")}
                className="text-gray-600 hover:text-[#000080]"
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <form action={signOut}>
                <Button variant="ghost" size="sm" className="text-gray-600 hover:text-red-600">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Upload & Add Links */}
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Import
                </TabsTrigger>
                <TabsTrigger value="add-link" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Link
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="mt-6">
                <UploadDropzone onUploadComplete={handleUploadComplete} />
              </TabsContent>

              <TabsContent value="add-link" className="mt-6">
                <AddLinkForm onLinkAdded={handleLinkAdded} />
              </TabsContent>

              <TabsContent value="settings" className="mt-6">
                <ApiKeyManager />
              </TabsContent>
            </Tabs>

            {/* Welcome Message */}
            <Card className="mt-8">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold text-[#000080] mb-4">Welcome to AI Bookmark Organizer</h2>
                <div className="space-y-3 text-gray-600">
                  <p>
                    🚀 <strong>Import your Chrome bookmarks</strong> - Export from Chrome and upload the HTML file
                  </p>
                  <p>
                    🔗 <strong>Add individual links</strong> - Manually add bookmarks with custom categories
                  </p>
                  <p>
                    🤖 <strong>AI-powered organization</strong> - Get summaries and smart categorization
                  </p>
                  <p>
                    🔍 <strong>Semantic search</strong> - Ask the AI assistant to find tools for specific tasks
                  </p>
                </div>
                <div className="mt-4 p-4 bg-[#54a09b]/10 rounded-lg border border-[#54a09b]/20">
                  <p className="text-sm text-[#54a09b] font-medium">
                    💡 Don't forget to add your Gemini API key in Settings to enable AI features!
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Chat Panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <ChatPanel />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
