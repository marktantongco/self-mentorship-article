import { Client } from '@notionhq/client'

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
})

export const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID

export interface NotionPage {
  id: string
  title: string
  url: string
}

// Search all pages in workspace
export async function searchAllPages(pageSize: number = 100): Promise<any[]> {
  const allResults: any[] = []
  let hasMore = true
  let startCursor: string | undefined = undefined
  
  while (hasMore) {
    const response = await notion.search({
      query: '',
      filter: {
        property: 'object',
        value: 'page'
      },
      page_size: Math.min(pageSize, 100),
      start_cursor: startCursor
    })
    
    allResults.push(...response.results)
    hasMore = response.has_more
    startCursor = response.next_cursor || undefined
  }
  
  return allResults
}

// Query database entries using search (v5 API compatible)
export async function queryDatabaseEntries(): Promise<any[]> {
  // Use search to find pages in this database
  const allPages = await searchAllPages()
  
  // Filter to pages belonging to this database
  return allPages.filter((page: any) => {
    const parentId = page.parent?.data_source_id || page.parent?.database_id
    return parentId === NOTION_DATABASE_ID
  })
}

// Get database info
export async function getDatabaseInfo(): Promise<any> {
  if (!NOTION_DATABASE_ID) return null
  
  return await notion.databases.retrieve({
    database_id: NOTION_DATABASE_ID
  })
}

// Create a page in the database with content
export async function createDatabaseEntry(
  title: string,
  body: string,
  metadata: {
    type: 'Note' | 'Post'
    status: string
    tags?: string[]
    wordCount?: number
    substackLink?: string
  }
): Promise<NotionPage> {
  if (!NOTION_DATABASE_ID) {
    throw new Error('NOTION_DATABASE_ID not configured')
  }

  // Create the page with just the title (only property in DB)
  const page = await notion.pages.create({
    parent: { database_id: NOTION_DATABASE_ID },
    properties: {
      'Name': {
        title: [{ text: { content: title } }]
      }
    }
  })

  // Add content as blocks
  const blocks = createBlocksFromMarkdown(body, metadata)
  
  // Add blocks in batches of 100
  for (let i = 0; i < blocks.length; i += 100) {
    await notion.blocks.children.append({
      block_id: page.id,
      children: blocks.slice(i, i + 100) as any
    })
  }

  return {
    id: page.id,
    title,
    url: (page as any).url || ''
  }
}

// Convert markdown to Notion blocks
function createBlocksFromMarkdown(body: string, metadata: { type: string; status: string; tags?: string[]; wordCount?: number }): any[] {
  const blocks: any[] = []
  
  // Add metadata block at top
  blocks.push({
    type: 'callout',
    callout: {
      rich_text: [{ text: { content: `📋 ${metadata.type} | ${metadata.status} | ${metadata.wordCount || 0} words` } }],
      icon: { emoji: '📝' },
      color: 'blue_background'
    }
  })

  // Add tags if present
  if (metadata.tags && metadata.tags.length > 0) {
    blocks.push({
      type: 'paragraph',
      paragraph: {
        rich_text: [{ text: { content: `🏷️ Tags: ${metadata.tags.join(', ')}` } }]
      }
    })
  }

  // Add divider
  blocks.push({ type: 'divider', divider: {} })

  // Parse body into blocks
  const paragraphs = body.split('\n\n')
  
  for (const para of paragraphs) {
    if (!para.trim()) continue
    
    const lines = para.split('\n')
    
    for (const line of lines) {
      if (!line.trim()) continue
      
      // Heading 1
      if (line.startsWith('# ')) {
        blocks.push({
          type: 'heading_1',
          heading_1: { rich_text: [{ text: { content: line.slice(2) } }] }
        })
      }
      // Heading 2
      else if (line.startsWith('## ')) {
        blocks.push({
          type: 'heading_2',
          heading_2: { rich_text: [{ text: { content: line.slice(3) } }] }
        })
      }
      // Heading 3
      else if (line.startsWith('### ')) {
        blocks.push({
          type: 'heading_3',
          heading_3: { rich_text: [{ text: { content: line.slice(4) } }] }
        })
      }
      // Quote
      else if (line.startsWith('> ')) {
        blocks.push({
          type: 'quote',
          quote: { rich_text: [{ text: { content: line.slice(2) } }] }
        })
      }
      // Bullet list
      else if (line.startsWith('- ')) {
        blocks.push({
          type: 'bulleted_list_item',
          bulleted_list_item: { rich_text: [{ text: { content: line.slice(2) } }] }
        })
      }
      // Numbered list
      else if (/^\d+\. /.test(line)) {
        blocks.push({
          type: 'numbered_list_item',
          numbered_list_item: { rich_text: [{ text: { content: line.replace(/^\d+\. /, '') } }] }
        })
      }
      // Horizontal rule
      else if (line.match(/^---+$/)) {
        blocks.push({ type: 'divider', divider: {} })
      }
      // Table row (simplified)
      else if (line.startsWith('|')) {
        blocks.push({
          type: 'paragraph',
          paragraph: { rich_text: [{ text: { content: line } }] }
        })
      }
      // Regular paragraph
      else {
        // Handle bold and italic
        let text = line
          .replace(/\*\*(.+?)\*\*/g, '$1')
          .replace(/\*(.+?)\*/g, '$1')
          .slice(0, 2000) // Notion limit
        
        blocks.push({
          type: 'paragraph',
          paragraph: { rich_text: [{ text: { content: text } }] }
        })
      }
    }
  }

  // Add footer
  blocks.push({ type: 'divider', divider: {} })
  blocks.push({
    type: 'paragraph',
    paragraph: {
      rich_text: [{ text: { content: '✍️ Created via Content Pipeline Dashboard' } }]
    }
  })

  return blocks
}

// Get page content as markdown
export async function getPageContent(pageId: string): Promise<string> {
  const blocks = await notion.blocks.children.list({
    block_id: pageId,
    page_size: 100
  })

  return blocks.results
    .map((block: any) => {
      const type = block.type
      const text = block[type]?.rich_text?.[0]?.plain_text || ''
      
      switch (type) {
        case 'heading_1': return `# ${text}`
        case 'heading_2': return `## ${text}`
        case 'heading_3': return `### ${text}`
        case 'quote': return `> ${text}`
        case 'bulleted_list_item': return `- ${text}`
        case 'numbered_list_item': return `1. ${text}`
        case 'code': return `\`\`\`\n${text}\n\`\`\``
        case 'divider': return '---'
        default: return text
      }
    })
    .join('\n\n')
}

export { notion }
