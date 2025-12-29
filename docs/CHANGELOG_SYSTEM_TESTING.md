# Changelog System - Testing Guide

## Overview

This document provides a comprehensive testing guide for the newly implemented Changelog & Version Management System.

## System Components

1. **Backend (Convex)**
   - `convex/schema.ts` - Database schema with `appVersions` and `changelogEntries` tables
   - `convex/versions.ts` - Queries and Mutations for version management

2. **Admin UI**
   - `/admin/changelog` - Admin interface for managing versions and changelog entries

3. **Public UI**
   - `/changelog` - Public changelog page for users
   - Sidebar footer - Version display with link to changelog

4. **Deployment Integration**
   - `scripts/bump-version.ts` - Automatic version bumping on build
   - `package.json` - Build script integration

## Testing Checklist

### 1. Backend Testing

#### Schema Validation
- [ ] Verify `appVersions` table exists in Convex dashboard
- [ ] Verify `changelogEntries` table exists in Convex dashboard
- [ ] Check all indexes are created correctly:
  - `appVersions`: by_environment, by_version, by_current
  - `changelogEntries`: by_version, by_category, by_language

#### Queries Testing
- [ ] Test `getCurrentVersion` query
  - Returns current version for beta environment
  - Returns current version for production environment
  - Returns null if no version exists
- [ ] Test `getAllVersions` query
  - Returns paginated list of versions
  - Respects limit and offset parameters
- [ ] Test `getVersionWithChangelog` query
  - Returns version with all changelog entries
  - Filters by language correctly
  - Entries are sorted by order field
- [ ] Test `getChangelogHistory` query
  - Returns versions sorted by release date (newest first)
  - Groups entries by category
  - Filters by language

#### Mutations Testing
- [ ] Test `createVersion` mutation
  - Requires admin authentication
  - Validates semantic versioning format
  - Prevents duplicate versions
  - Sets isCurrent flag correctly
  - Unsets previous current version
- [ ] Test `addChangelogEntry` mutation
  - Requires admin authentication
  - Creates entry with correct order
  - Links to version correctly
- [ ] Test `updateChangelogEntry` mutation
  - Requires admin authentication
  - Updates fields correctly
- [ ] Test `deleteChangelogEntry` mutation
  - Requires admin authentication
  - Deletes entry successfully
- [ ] Test `setCurrentVersion` mutation
  - Requires admin authentication
  - Updates isCurrent flags correctly

### 2. Admin UI Testing

#### Version Management
- [ ] Navigate to `/admin/changelog` as admin
- [ ] Click "New Version" button
- [ ] Create version with valid semantic version (e.g., 1.0.0)
  - Verify version appears in versions list
  - Verify it's marked as current
- [ ] Try creating version with invalid format (e.g., "1.0")
  - Verify validation error
- [ ] Try creating duplicate version
  - Verify error message
- [ ] Select different environments (beta, production, staging)
  - Verify environment is saved correctly

#### Changelog Entry Management
- [ ] Select a version from the list
- [ ] Click "Add Entry" button
- [ ] Create entry with:
  - Category: Added
  - Language: English
  - Title: "Test feature"
  - Description: "Test description"
  - Verify entry appears in table
- [ ] Create entries for all categories (Added, Changed, Fixed, Removed)
  - Verify correct badge colors
- [ ] Create entries in both languages (EN, DE)
  - Verify language badges
- [ ] Edit an entry
  - Change title and description
  - Verify changes are saved
- [ ] Delete an entry
  - Confirm deletion dialog appears
  - Verify entry is removed

#### UI/UX Testing
- [ ] Verify responsive design on mobile
- [ ] Verify all buttons are clickable
- [ ] Verify dialogs open and close correctly
- [ ] Verify toast notifications appear for success/error
- [ ] Verify loading states during mutations

### 3. Public Changelog Page Testing

#### Page Access
- [ ] Navigate to `/changelog` (without authentication)
- [ ] Verify page loads successfully
- [ ] Verify header displays correctly

#### Content Display
- [ ] Verify versions are displayed chronologically (newest first)
- [ ] Verify each version shows:
  - Version number
  - Environment
  - Release date
  - "Current" badge if applicable
- [ ] Verify changelog entries are grouped by category:
  - Added (green)
  - Changed (blue)
  - Fixed (orange)
  - Removed (red)
- [ ] Verify category icons display correctly
- [ ] Verify entries show title and description
- [ ] Verify empty state when no versions exist

#### Multi-Language Support
- [ ] Change language preference (if implemented)
- [ ] Verify changelog entries display in correct language
- [ ] Verify fallback to English if translation missing

#### Responsive Design
- [ ] Test on mobile viewport
- [ ] Test on tablet viewport
- [ ] Test on desktop viewport
- [ ] Verify all elements are readable and accessible

### 4. Version Display in Sidebar

- [ ] Login as any user
- [ ] Navigate to any protected page
- [ ] Verify sidebar footer shows version number
- [ ] Verify "View Changelog" link is visible
- [ ] Click on version display
  - Verify redirects to `/changelog`
- [ ] Test with collapsed sidebar
  - Verify version display is hidden when collapsed

### 5. Deployment Integration Testing

#### Version Bump Script
- [ ] Run `tsx scripts/bump-version.ts` locally
  - Verify script reads current version
  - Verify script increments version correctly
  - Verify package.json is updated
- [ ] Test with environment variables:
  - `BUMP_VERSION_TYPE=major` - Verify major increment
  - `BUMP_VERSION_TYPE=minor` - Verify minor increment
  - `BUMP_VERSION_TYPE=patch` - Verify patch increment (default)
- [ ] Verify script handles missing Convex URL gracefully

#### Build Integration
- [ ] Run `pnpm build` locally
  - Verify version bump script runs before build
  - Verify build completes successfully
  - Verify package.json version is updated

#### Vercel Deployment
- [ ] Deploy to Vercel
  - Verify version bump script runs during build
  - Verify environment variables are set:
    - `VERCEL_GIT_COMMIT_SHA`
    - `VERCEL_GIT_COMMIT_REF`
  - Verify build completes successfully
- [ ] After deployment:
  - Check package.json version in deployed code
  - Manually create version in Admin UI with deployment info

### 6. Semantic Versioning Validation

#### Valid Versions
- [ ] Test version: 1.0.0 (valid)
- [ ] Test version: 2.1.3 (valid)
- [ ] Test version: 10.20.30 (valid)

#### Invalid Versions
- [ ] Test version: 1.0 (invalid - missing patch)
- [ ] Test version: 1 (invalid - missing minor and patch)
- [ ] Test version: 1.0.0.0 (invalid - too many parts)
- [ ] Test version: v1.0.0 (invalid - has 'v' prefix)
- [ ] Test version: 1.0.0-beta (invalid - has suffix)

### 7. Security Testing

#### Authentication
- [ ] Try accessing `/admin/changelog` without authentication
  - Verify redirect to sign-in
- [ ] Try accessing `/admin/changelog` as student
  - Verify access denied or redirect
- [ ] Access `/admin/changelog` as admin
  - Verify full access

#### Authorization
- [ ] Try calling mutations without authentication
  - Verify "Not authenticated" error
- [ ] Try calling mutations as student
  - Verify "Unauthorized" error
- [ ] Call mutations as admin
  - Verify success

### 8. Edge Cases & Error Handling

- [ ] Create version when no versions exist (first version)
- [ ] Create version when current version exists (version transition)
- [ ] Add entry to version with no entries
- [ ] Add entry to version with existing entries (order calculation)
- [ ] Update entry with partial data (only title, only description, etc.)
- [ ] Delete last entry in a version
- [ ] View changelog when no versions exist
- [ ] View version with no entries
- [ ] Handle Convex connection errors gracefully
- [ ] Handle network timeouts

### 9. Performance Testing

- [ ] Create 50+ versions
  - Verify pagination works correctly
  - Verify page load time is acceptable
- [ ] Create 100+ changelog entries for one version
  - Verify table rendering performance
  - Verify sorting performance
- [ ] Test changelog page with 20+ versions
  - Verify load time is acceptable
  - Verify scroll performance

### 10. Integration Testing

- [ ] Create version → Add entries → View in public changelog
  - Verify end-to-end flow works
- [ ] Create version → Set as current → Verify sidebar displays correct version
- [ ] Build → Deploy → Create version → Verify version matches package.json
- [ ] Change language → View changelog → Verify correct translations

## Manual Testing Script

### Initial Setup
```bash
# 1. Start development server
pnpm dev

# 2. Login as admin
# Navigate to /sign-in and login with admin credentials

# 3. Navigate to admin changelog
# Go to /admin/changelog
```

### Create First Version
```
1. Click "New Version"
2. Enter version: 1.0.0
3. Select environment: Beta
4. Click "Create Version"
5. Verify version appears in list with "Current" badge
```

### Add Changelog Entries
```
1. Select version 1.0.0
2. Click "Add Entry"
3. Category: Added
4. Language: English
5. Title: "Initial beta release"
6. Description: "Serbian AI Tutor beta version with core features"
7. Click "Add Entry"
8. Repeat for multiple entries in different categories
```

### View Public Changelog
```
1. Navigate to /changelog
2. Verify version 1.0.0 is displayed
3. Verify all entries are visible
4. Verify categories are color-coded
5. Verify responsive design
```

### Test Version Bump
```bash
# 1. Run version bump script
tsx scripts/bump-version.ts

# 2. Check package.json
# Verify version is incremented

# 3. Create new version in Admin UI
# Use the new version number from package.json
```

## Known Limitations

1. **Authentication in Scripts**: The version bump script cannot create versions in Convex automatically due to authentication requirements. Versions must be created manually via Admin UI after deployment.

2. **Manual Version Creation**: After each deployment, an admin must manually create the corresponding version entry in the Admin UI.

3. **No Automatic Changelog Generation**: Changelog entries must be manually created by admins. There is no automatic generation from git commits.

## Future Improvements

- [ ] Automatic version creation during deployment (with service account)
- [ ] Git commit integration for automatic changelog generation
- [ ] Version comparison view
- [ ] Email notifications for new versions
- [ ] RSS feed for changelog
- [ ] Export changelog as Markdown
- [ ] Version rollback functionality
- [ ] Changelog entry templates
- [ ] Bulk entry management
- [ ] Version tagging system

## Success Criteria

The system is considered fully functional when:

1. ✅ All backend queries and mutations work correctly
2. ✅ Admin UI allows full CRUD operations on versions and entries
3. ✅ Public changelog displays correctly for all users
4. ✅ Version display in sidebar works and links to changelog
5. ✅ Build integration runs without errors
6. ✅ Semantic versioning validation works correctly
7. ✅ Multi-language support functions properly
8. ✅ Authentication and authorization are enforced
9. ✅ All edge cases are handled gracefully
10. ✅ Performance is acceptable with realistic data volumes

## Conclusion

This testing guide provides comprehensive coverage of the Changelog & Version Management System. Follow this guide to ensure all components are working correctly before deploying to production.

For any issues or bugs found during testing, please document them and report to the development team.
