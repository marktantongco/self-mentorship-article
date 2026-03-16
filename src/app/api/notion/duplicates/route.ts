import { NextRequest, NextResponse } from 'next/server'
import { notion, searchAllPages } from '@/lib/notion'

interface NotionPageInfo {
  id: string
  title: string
  url: string
  lastEditedTime: string
  createdTime: string
  parentId: string | null
  parentType: string
  isDatabaseEntry: boolean
  contentPreview: string
}

interface DuplicateGroup {
  title: string
  pages: NotionPageInfo[]
  action: 'MERGE_DELETE' | 'SKIP_LINKED' | 'IDENTICAL_SAFE'
  keepPage: NotionPageInfo | null
  pagesToDelete: NotionPageInfo[]
}

// Extract title from page properties
function extractTitle(page: any): string {
  const properties = page.properties
  
  // Check common title property names
  for (const propName of ['Name', 'Title', 'title', '名称']) {
    if (properties[propName]) {
      const prop = properties[propName]
      if (prop.type === 'title' && prop.title?.length > 0) {
        return prop.title.map((t: any) => t.plain_text).join('')
      }
    }
  }
  
  return 'Untitled'
}

// Get page content as text
async function getPageContent(pageId: string): Promise<string> {
  try {
    const blocks = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100
    })
    
    const textParts: string[] = []
    
    for (const block of blocks.results) {
      const type = (block as any).type
      const richText = (block as any)[type]?.rich_text
      if (richText && Array.isArray(richText)) {
        textParts.push(richText.map((t: any) => t.plain_text).join(''))
      }
    }
    
    return textParts.join('\n').slice(0, 5000)
  } catch {
    return ''
  }
}

// Normalize title for comparison
function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/[-–—]/g, '-').replace(/\s+/g, ' ')
}

// Check if content is similar (>80% match)
function calculateSimilarity(content1: string, content2: string): number {
  const words1 = new Set(content1.toLowerCase().split(/\s+/))
  const words2 = new Set(content2.toLowerCase().split(/\s+/))
  
  const intersection = new Set([...words1].filter(x => words2.has(x)))
  const union = new Set([...words1, ...words2])
  
  return union.size > 0 ? intersection.size / union.size : 0
}

// GET /api/notion/duplicates - Scan for duplicates
export async function GET(request: NextRequest) {
  try {
    console.log('Starting Notion workspace scan...')
    
    // Search all pages
    const allPagesRaw = await searchAllPages()
    console.log(`Found ${allPagesRaw.length} total pages`)
    
    const allPages: NotionPageInfo[] = []
    
    // Process each page
    for (const page of allPagesRaw) {
      const title = extractTitle(page)
      const parent = (page as any).parent
      
      allPages.push({
        id: page.id,
        title,
        url: (page as any).url || '',
        lastEditedTime: (page as any).last_edited_time,
        createdTime: (page as any).created_time,
        parentId: parent?.data_source_id || parent?.database_id || parent?.page_id || null,
        parentType: parent?.type || 'unknown',
        isDatabaseEntry: parent?.type === 'data_source_id' || parent?.type === 'database_id',
        contentPreview: '' // Will be loaded on demand
      })
    }
    
    // Group by normalized title
    const titleGroups: Map<string, NotionPageInfo[]> = new Map()
    
    for (const page of allPages) {
      const normalizedTitle = normalizeTitle(page.title)
      if (!normalizedTitle || normalizedTitle === 'untitled') continue
      
      if (!titleGroups.has(normalizedTitle)) {
        titleGroups.set(normalizedTitle, [])
      }
      titleGroups.get(normalizedTitle)!.push(page)
    }
    
    // Find duplicate groups
    const duplicateGroups: DuplicateGroup[] = []
    
    for (const [normalizedTitle, pages] of titleGroups) {
      if (pages.length < 2) continue
      
      // Sort by last edited time (most recent first)
      pages.sort((a, b) => 
        new Date(b.lastEditedTime).getTime() - new Date(a.lastEditedTime).getTime()
      )
      
      // Check if all are from the same database (linked views)
      const dataSourceIds = new Set(pages.map(p => p.parentId).filter(Boolean))
      const allFromSameDb = dataSourceIds.size === 1 && pages.every(p => p.isDatabaseEntry)
      
      // Determine action
      let action: 'MERGE_DELETE' | 'SKIP_LINKED' | 'IDENTICAL_SAFE' = 'MERGE_DELETE'
      
      if (allFromSameDb) {
        // These might be different views of same data - skip
        action = 'SKIP_LINKED'
      }
      
      const group: DuplicateGroup = {
        title: pages[0].title,
        pages,
        action,
        keepPage: action === 'SKIP_LINKED' ? null : pages[0],
        pagesToDelete: action === 'SKIP_LINKED' ? [] : pages.slice(1)
      }
      
      duplicateGroups.push(group)
    }
    
    // Calculate summary
    const summary = {
      totalScanned: allPages.length,
      duplicateGroupsFound: duplicateGroups.length,
      totalDuplicates: duplicateGroups.reduce((sum, g) => sum + g.pagesToDelete.length, 0),
      linkedViewsSkipped: duplicateGroups.filter(g => g.action === 'SKIP_LINKED').length,
      mergesRequired: duplicateGroups.filter(g => g.action === 'MERGE_DELETE').length
    }
    
    return NextResponse.json({
      success: true,
      data: {
        summary,
        duplicateGroups
      }
    })
  } catch (error: any) {
    console.error('Duplicate scan error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST /api/notion/duplicates - Merge and archive duplicates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, pageIds, keepPageId } = body
    
    if (action !== 'MERGE_AND_ARCHIVE') {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use MERGE_AND_ARCHIVE' },
        { status: 400 }
      )
    }
    
    if (!keepPageId || !pageIds?.length) {
      return NextResponse.json(
        { success: false, error: 'keepPageId and pageIds required' },
        { status: 400 }
      )
    }
    
    const results = {
      merged: [] as string[],
      archived: [] as string[],
      errors: [] as string[]
    }
    
    // Get content of the page to keep
    const keepContent = await getPageContent(keepPageId)
    
    // Process each page to archive
    for (const pageId of pageIds) {
      if (pageId === keepPageId) continue
      
      try {
        // Get content of old page
        const oldContent = await getPageContent(pageId)
        
        // Check for unique content
        const similarity = calculateSimilarity(keepContent, oldContent)
        
        // If content is different enough, merge unique parts
        if (similarity < 0.9) {
          const oldLines = oldContent.split('\n').filter(l => l.trim().length > 20)
          const keepLines = new Set(keepContent.toLowerCase().split('\n'))
          
          const uniqueLines = oldLines.filter(line => 
            !keepLines.has(line.toLowerCase().trim())
          )
          
          if (uniqueLines.length > 0) {
            // Append unique content
            await notion.blocks.children.append({
              block_id: keepPageId,
              children: [{
                type: 'divider',
                divider: {}
              }, {
                type: 'paragraph',
                paragraph: {
                  rich_text: [{
                    type: 'text',
                    text: { content: `📦 Merged from duplicate (${new Date().toISOString().split('T')[0]})` }
                  }]
                }
              }, {
                type: 'paragraph',
                paragraph: {
                  rich_text: [{
                    type: 'text',
                    text: { content: uniqueLines.join('\n').slice(0, 1900) }
                  }]
                }
              }]
            })
            results.merged.push(pageId)
          }
        }
        
        // Archive the old page
        await notion.pages.update({
          page_id: pageId,
          archived: true
        })
        
        results.archived.push(pageId)
        
      } catch (err: any) {
        results.errors.push(`${pageId}: ${err.message}`)
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Archived ${results.archived.length} duplicate(s), merged content from ${results.merged.length}`,
      data: results
    })
  } catch (error: any) {
    console.error('Merge/archive error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
