# Substack Content Pipeline — Notion Database Setup

> **Source of Truth** for your AI → Notion → n8n → Substack automation.

---

## Quick Setup

### Step 1: Create the Database

1. Open Notion
2. Create a new page named **"Substack Content Pipeline"**
3. Add a **Database (Full Page)** block
4. Name it **"Content Pipeline"**

---

## Required Properties

| Property Name | Type | Purpose | Options/Values |
|---------------|------|---------|----------------|
| **Name** | Title | Main headline/title of post | — |
| **Body** | Rich Text | Markdown content from AI agent | — |
| **Type** | Select | Content classification | `Note`, `Post` |
| **Status** | Status | Automation trigger | `Draft`, `Ready to Publish`, `Published` |
| **Substack Link** | URL | Live link after publishing | — |

---

## Property Configuration Details

### Name (Title)
- **Type:** Title
- **Purpose:** Main headline or title of your post
- **Auto-populated:** No — enter manually
- **Example:** `Stop Telling Yourself What To Do. Start Mentoring Yourself Instead.`

---

### Body (Rich Text)
- **Type:** Rich Text (Text)
- **Purpose:** Holds Markdown-formatted content from AI
- **Supports:**
  - Headers (`#`, `##`, `###`)
  - Bold (`**text**`)
  - Italic (`*text*`)
  - Code blocks (```)
  - Lists (`-`, `1.`)
  - Links (`[text](url)`)
  - Blockquotes (`>`)
  - Tables
- **Workflow:** Copy AI output → Paste into this field

---

### Type (Select)

**Type:** Select

**Options:**

| Option | Description | Substack Output |
|--------|-------------|-----------------|
| `Note` | Short-form content | Substack Note (≤280 chars typical) |
| `Post` | Long-form article | Full Substack Post |

**Color Coding (Recommended):**
- `Note` → Blue
- `Post` → Purple

---

### Status (Status)

**Type:** Status

**Options:**

| Status | Description | Who Sets It |
|--------|-------------|-------------|
| `Draft` | Work in progress | You (manual) |
| `Ready to Publish` | **TRIGGERS n8n workflow** | You (manual) |
| `Published` | Successfully posted | n8n (automatic) |

**Color Coding (Recommended):**
- `Draft` → Gray
- `Ready to Publish` → Yellow
- `Published` → Green

**⚠️ Critical:** The `Ready to Publish` status is the trigger. n8n scans for pages with this status and processes them.

---

### Substack Link (URL)

- **Type:** URL
- **Purpose:** Stores the live Substack link after publishing
- **Populated by:** n8n (automatic)
- **Format:** `https://markytanky.substack.com/p/[slug]`

---

## Automation Flow

```
┌─────────────────┐
│   AI Agent      │
│   (OpenCode)    │
└────────┬────────┘
         │ Generate content
         ▼
┌─────────────────┐
│    Notion DB    │
│  Content Pipeline│
│                 │
│ Status: Draft   │
└────────┬────────┘
         │ You review & change status
         ▼
┌─────────────────┐
│ Status: Ready   │
│  to Publish     │◄──── n8n scans every 1 min
└────────┬────────┘
         │ n8n detects & processes
         ▼
┌─────────────────┐
│   Substack      │
│   API Post      │
└────────┬────────┘
         │ Success
         ▼
┌─────────────────┐
│ Status:         │
│  Published      │
│ + Substack Link │
└─────────────────┘
```

---

## n8n Workflow Logic

### Scan Frequency
- **Interval:** Every 1 minute
- **Trigger:** Notion database query

### Query Criteria
```
Filter by:
  Status = "Ready to Publish"
```

### Processing Logic

```
IF Type = "Note":
  → POST to Substack Notes API
  → Short-form formatting

IF Type = "Post":
  → POST to Substack Posts API
  → Full Markdown rendering
  → Generate slug from Title

ON SUCCESS:
  → Update Status → "Published"
  → Populate Substack Link field

ON FAILURE:
  → Log error
  → Keep Status = "Ready to Publish" (retry)
  → Send notification (optional)
```

---

## Example Database Entry

### For Long-Form Post

| Property | Value |
|----------|-------|
| **Name** | Stop Telling Yourself What To Do. Start Mentoring Yourself Instead. |
| **Body** | *(Full Markdown content)* |
| **Type** | Post |
| **Status** | Ready to Publish |
| **Substack Link** | *(Empty until published)* |

### For Short-Form Note

| Property | Value |
|----------|-------|
| **Name** | Mentor Mindset Shift |
| **Body** | Most people command themselves like a task list. But task lists don't grow — they just get longer. What if you became your own mentor instead of your own boss? |
| **Type** | Note |
| **Status** | Ready to Publish |
| **Substack Link** | *(Empty until published)* |

---

## Notion Database Template

Copy this structure into Notion:

```
📊 Substack Content Pipeline

┌─────────────────────────────────────────────────────────────────┐
│ Name (Title)          │ Body      │ Type │ Status │ Substack   │
│                       │           │      │        │ Link       │
├───────────────────────┼───────────┼──────┼────────┼────────────┤
│ Your Article Title    │ [MD]      │ Post │ Draft  │            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Optional Add-On Properties

Enhance your pipeline with these optional fields:

| Property | Type | Purpose |
|----------|------|---------|
| **Author** | Person | Track who created the content |
| **Created** | Created time | Auto-timestamp |
| **Tags** | Multi-select | SEO keywords |
| **Category** | Select | Content categorization |
| **Scheduled Date** | Date | Future publish date |
| **Word Count** | Number | Content length tracking |
| **Notes** | Rich Text | Internal comments |
| **Retry Count** | Number | Track failed publish attempts |

---

## Setup Checklist

```
[ ] Create Notion page "Substack Content Pipeline"
[ ] Add Database (Full Page)
[ ] Add property: Name (Title) — default
[ ] Add property: Body (Rich Text)
[ ] Add property: Type (Select) — options: Note, Post
[ ] Add property: Status (Status) — options: Draft, Ready to Publish, Published
[ ] Add property: Substack Link (URL)
[ ] Configure n8n Notion integration
[ ] Configure n8n Substack integration
[ ] Set n8n scan interval (1 min)
[ ] Test with sample entry
```

---

## API Credentials Needed

### Notion Integration

1. Go to https://www.notion.so/my-integrations
2. Create new integration
3. Copy **Internal Integration Token**
4. Go to your database page
5. Click `...` → Add connections → Select your integration

### Substack API

- Substack uses API keys for publication access
- Contact Substack support for API access
- Alternative: Use email-to-post or browser automation

---

## Security Notes

- Store API tokens in n8n credentials (never in code)
- Use environment variables for sensitive values
- Limit Notion integration permissions to specific databases
- Enable n8n workflow logs for debugging

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| n8n not detecting pages | Check Status = exact match "Ready to Publish" |
| Markdown not rendering | Verify Body field type is Rich Text |
| Duplicate posts | Status not updating to "Published" |
| API errors | Check token expiry and permissions |

---

*Pipeline designed for AI → Notion → n8n → Substack automation.*
