"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, FileText, Loader2 } from "lucide-react"

interface UploadDropzoneProps {
  onUploadComplete?: () => void
}

export default function UploadDropzone({ onUploadComplete }: UploadDropzoneProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const file = files[0]
    if (!file.name.endsWith(".html")) {
      alert("Please select an HTML file (Chrome bookmarks export)")
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (response.ok) {
        alert("Bookmarks imported successfully!")
        onUploadComplete?.()
      } else {
        alert(`Import failed: ${result.error}`)
      }
    } catch (error) {
      console.error("Upload error:", error)
      alert("Failed to upload file. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files)
    }
  }

  const onButtonClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#000080]">
          <FileText className="h-5 w-5" />
          Import Chrome Bookmarks
        </CardTitle>
        <CardDescription>Upload your Chrome bookmarks HTML file to organize them with AI</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragActive ? "border-[#54a09b] bg-[#54a09b]/5" : "border-gray-300 hover:border-[#54a09b]"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".html"
            onChange={handleChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isUploading}
          />

          <div className="flex flex-col items-center gap-4">
            {isUploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-[#54a09b]" />
            ) : (
              <Upload className="h-8 w-8 text-gray-400" />
            )}

            <div>
              <p className="text-sm font-medium text-gray-900">
                {isUploading ? "Processing bookmarks..." : "Drop your bookmarks file here"}
              </p>
              <p className="text-xs text-gray-500 mt-1">or click to browse for files</p>
            </div>

            <Button
              onClick={onButtonClick}
              disabled={isUploading}
              className="bg-[#54a09b] hover:bg-[#4a8f8a] text-white"
            >
              {isUploading ? "Uploading..." : "Choose File"}
            </Button>
          </div>

          <div className="mt-4 text-xs text-gray-500">
            <p>Export your Chrome bookmarks:</p>
            <p>Chrome → Bookmarks → Bookmark Manager → ⋮ → Export bookmarks</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
