# Email Template Migration - Complete ✅

This document describes the email template migration from hardcoded templates to a database-managed system using Convex.

## What Was Done

### 1. ✅ Added Email Templates Schema to Convex
- Added `emailTemplates` table to `convex/schema.ts`
- Supports template name, subject, HTML content, variables, categories, and active status
- Indexed by name, category, and active status for efficient queries

### 2. ✅ Created Convex Functions for Template Management
- **`convex/emailTemplates.ts`** - Full CRUD operations for email templates
  - `getAll` - Get all templates (admin only)
  - `getByName` - Get template by name
  - `getById` - Get template by ID
  - `upsert` - Create or update template (superadmin only)
  - `remove` - Delete template (superadmin only)
  - `render` - Render template with variables
  - `detectVariables` - Auto-detect variables from template content

### 3. ✅ Created Migration Script
- **`scripts/migrate-email-templates.ts`** - Extracts templates from `server/_core/email.ts` and imports them into Convex
- Migrates 3 templates (legacy `user-activation` was removed; it was never used by the Convex email flow):
  - `beta-registration` - Beta registration / welcome confirmation
  - `feedback-confirmation` - Feedback submission confirmation
  - `feedback-admin-notification` - Admin notification for new feedback

### 4. ✅ Updated Email Service
- **`server/_core/emailTemplates.ts`** - Helper functions to fetch and render templates from Convex
- **`server/_core/email.ts`** - Updated all email functions to:
  - First try to use templates from Convex
  - Fall back to hardcoded templates if Convex is unavailable
  - Maintains backward compatibility

## How to Use

### Step 1: Run the Migration

```bash
# Make sure CONVEX_URL is set in your environment
export CONVEX_URL="https://your-convex-deployment.convex.cloud"

# Run the migration
pnpm migrate:email-templates
```

Or use the npm script:
```bash
pnpm migrate:email-templates
```

The script will:
- Connect to your Convex deployment
- Extract templates from the current email functions
- Import them into the `emailTemplates` table
- Show success/error status for each template

### Step 2: Verify Templates in Convex Dashboard

1. Go to your Convex dashboard
2. Navigate to the `emailTemplates` table
3. Verify that all templates were imported successfully

### Step 3: Test Email Sending

The email service will automatically:
- Try to fetch templates from Convex first
- Fall back to hardcoded templates if Convex is unavailable
- Log warnings if templates can't be found

## Template Variables

Each template supports variables using `{{VARIABLE_NAME}}` syntax:

### beta-registration
- `{{USER_NAME}}` - User's name
- `{{USER_EMAIL}}` - User's email

### feedback-confirmation
- `{{USER_NAME}}` - User's name
- `{{USER_EMAIL}}` - User's email
- `{{FEEDBACK_TYPE}}` - Type of feedback (with emoji)
- `{{FEEDBACK_TITLE}}` - Feedback title

### feedback-admin-notification
- `{{USER_NAME}}` - User's name
- `{{USER_EMAIL}}` - User's email
- `{{FEEDBACK_TYPE}}` - Type of feedback (with emoji)
- `{{FEEDBACK_TITLE}}` - Feedback title
- `{{FEEDBACK_DESCRIPTION}}` - Feedback description
- `{{ADMIN_EMAIL}}` - Admin email address

## Next Steps: Admin UI

To create an admin interface for managing templates, you'll need to:

1. Create a new page: `client/src/pages/EmailTemplates.tsx`
2. Add route to `client/src/App.tsx`: `/admin/email-templates`
3. Use the Convex functions:
   - `api.emailTemplates.getAll` - List all templates
   - `api.emailTemplates.upsert` - Create/update templates
   - `api.emailTemplates.remove` - Delete templates
   - `api.emailTemplates.render` - Preview templates

## Benefits

✅ **Centralized Management** - All templates in one place  
✅ **Easy Updates** - Change templates without code deployment  
✅ **Version Control** - Track template changes over time  
✅ **A/B Testing** - Easy to create variants  
✅ **Backward Compatible** - Falls back to hardcoded templates if needed  
✅ **Variable Detection** - Automatically detects variables in templates  

## Troubleshooting

### Templates not found
- Check that `CONVEX_URL` is set correctly
- Verify templates were imported successfully
- Check Convex dashboard for template status

### Fallback to hardcoded templates
- This is expected if Convex is unavailable
- Check server logs for warnings
- Verify Convex connection

### Migration fails
- Ensure `CONVEX_URL` is set
- Check that you're authenticated as superadmin
- Verify Convex deployment is running

