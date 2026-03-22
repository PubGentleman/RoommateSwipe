# Rhome - Mobile Design Guidelines

## Architecture & Navigation

### Authentication & User Roles
**Auth Required** - SSO (Apple/Google) + email fallback

**Three User Roles** with distinct onboarding:
- **Renters**: Capture budget range, lifestyle preferences, move-in timeline
- **Hosts**: Property ownership verification
- **Agents/Landlords**: Professional credentials, agency affiliation

**Account Features**: Role badge, profile completion %, logout confirmation, delete account (double confirmation), privacy/terms links

### Role-Based Tab Navigation

**Renter (5 tabs)**:
1. Explore - Property listings
2. **Roommates** - Swipe matching (CORE)
3. Groups - Browse/create roommate groups
4. Messages - Chat
5. Profile - Settings

**Host (4 tabs)**:
1. **My Listings** - Manage properties (CORE via FAB)
2. Applications - Review tenants
3. Messages
4. Profile

**Agent/Landlord (5 tabs)**:
1. Properties - Portfolio management
2. Verification - Document verification
3. Documents - Legal templates
4. Messages
5. Profile

## Key Screen Specifications

### Renter: Roommates Tab (Swipe Interface)
**Layout**: Full-screen card stack (NOT scrollable)
- **Header**: Transparent, logo centered, filter (right), match queue (left)
- **Card**: 60% photo, 40% details with gradient, compatibility badge (top right)
- **Actions**: Bottom buttons - Nope (X), Super Like (Star), Like (Heart) + Undo
- **Safe Areas**: Top: insets.top + 24pt, Bottom: tabBarHeight + 24pt + buttonHeight

**Swipe Gestures**: Left=Nope, Right=Like, Up=Super Like
- Tilt up to 15° during drag
- Red tint (left), green (right) opacity feedback
- 300ms spring animation exit
- Haptic on threshold

**Match Animation**: Full-screen modal, both profiles, "It's a Match!", confetti, Send Message/Keep Swiping buttons, 5s auto-dismiss

### Renter: Groups Tab
- **Header**: "Groups" title, search icon, create FAB
- **Content**: "My Groups" section → "Browse All Groups" infinite scroll
- **Group Cards**: Photo, member count, budget, location, compatibility score, Join button
- **Safe Areas**: Top: headerHeight + 24pt, Bottom: tabBarHeight + 24pt

### Renter: Explore Tab
- **Header**: Transparent, search bar, map toggle, filters
- **Content**: Property cards (image carousel, price, beds/baths, location, save heart icon)
- **Filters**: Price, bedrooms, amenities, distance
- **Sorting**: Price, Distance, Recent, AI Recommended

### Host: My Listings Tab
- **Header**: "My Listings", analytics icon
- **Content**: Listing cards with status badge (Active/Pending/Inactive), Edit/View Applications/Share actions
- **FAB**: Add New Listing (bottom right, elevated)
- **Safe Areas**: Bottom includes fabHeight

### Messages Tab (All Roles)
- **Header**: "Messages", search icon
- **Content**: FlatList - avatar, name, last message, timestamp, unread badge, online indicator (green dot)
- **Swipe Actions**: Archive, Mute, Delete
- **Empty State**: "No messages yet"

### Chat Window (Modal)
- **Header**: Custom with avatar, name, back, info icon
- **Content**: Inverted FlatList (bottom-to-top)
- **Input**: Fixed bottom - text input, attachment, send button
- **Features**: Message bubbles (sender/recipient styling), typing indicators, read receipts, attachments, quick responses

### Profile Tab (All Roles)
- **Header**: Transparent with role badge, settings icon
- **Content**: Profile photo (large, centered, editable), bio, role-specific fields, settings section
- **Form Pattern**: Inline editing with save states

## Design System

### Colors
**Brand**:
- Primary: #FF6B6B (coral/rose - CTAs, matches)
- Secondary: #4ECDC4 (teal - secondary actions)
- Background Light/Dark: #F8F9FA / #1A1A1A
- Surface Light/Dark: #FFFFFF / #2A2A2A

**Role Accents** (badges):
- Renter: #5B7FFF (blue)
- Host: #3ECF8E (green)
- Agent: #9B59B6 (purple)

**Semantic**: Success #3ECF8E, Warning #FFA500, Error #FF4757, Info #5B7FFF

**Text Light/Dark**: Primary #1A1A1A/#FFFFFF, Secondary #6C757D/#A0A0A0

### Typography
**Font**: System default (SF Pro iOS, Roboto Android)

**Scale**:
- Hero: 34pt Bold (swipe card names)
- H1: 28pt Bold (screen titles)
- H2: 22pt Semibold (sections)
- H3: 18pt Semibold (card titles)
- Body: 16pt Regular
- Caption: 14pt Regular (metadata)
- Small: 12pt Regular (labels)

### Spacing & Layout
**Scale**: xs=4pt, sm=8pt, md=12pt, lg=16pt, xl=24pt, xxl=32pt

**Standards**: Card padding lg (16pt), Screen padding lg (16pt), Section spacing xl (24pt), Touch targets 44x44pt min

**Border Radius**: Small 8pt (buttons), Medium 12pt (cards), Large 16pt (modals), Circular 50% (avatars)

### Component Specs

#### Swipe Cards
- **Size**: Full width - 32pt margins, Aspect 4:5
- **Shadow**: offset {0,4}, opacity 0.15, radius 8
- **Animation**: 300ms spring, 15° tilt, opacity fade

#### Action Buttons (Swipe)
- **Nope/Like**: 60pt diameter, white bg, red/green icon
- **Super Like**: 48pt diameter, white bg, blue icon
- **Shadow**: offset {0,2}, opacity 0.10, radius 2
- **Press**: Scale 0.95

#### FAB
- **Size**: 56pt diameter, 16pt from edges
- **Icon**: 24pt plus/action icon
- **Color**: Primary brand
- **Shadow**: offset {0,2}, opacity 0.10, radius 2

#### Property/Profile Cards
- **Image**: 16:9, 12pt corners
- **Padding**: md (12pt)
- **Divider**: 1pt border
- **Press**: Subtle bg change, no shadow

#### Tab Bar
- **Height**: 50pt + safe area
- **Active**: Primary color icon + label
- **Inactive**: Gray icon + label
- **Badge**: Red circle (unread)

### Interactions

**Gestures**: Swipe (matching), Pull-to-refresh (lists), Long-press (message actions)

**Animations**: Screen transitions 300ms, Card swipes 300ms spring (damping 0.8), Press states 100ms, Color transitions 200ms

**Haptics**: Light (button press), Medium (swipe threshold), Success (match)

**Feedback**: All touchables show press state, inline errors with retry, visible focus indicators

### Loading & States

**Loading**: Skeleton screens (initial), bottom spinner (pagination)

**Empty States**: Illustration + message + action
- "No roommates" → Adjust Filters
- "No messages" → Start Browsing

**Errors**: Inline with retry (avoid full-screen), offline banner

### Accessibility (WCAG AA)
- VoiceOver/TalkBack labels on all interactive elements
- 4.5:1 text contrast, 3:1 UI contrast
- Dynamic Type support up to 200%
- Alt text on images
- Respect reduced motion preference

### Dark Mode
- All colors have dark equivalents
- Photos maintain normal appearance
- UI elements invert appropriately
- Respect system setting

### Assets Required
1. **App Icon**: 1024x1024px
2. **Role Badges**: 3 designs (48x48pt)
3. **Empty State Illustrations**: No matches, messages, groups, error
4. **Match Celebration**: Confetti animation
5. **System Icons**: Feather icon set (@expo/vector-icons)
6. **Onboarding**: 3-4 screens (optional)

### Platform Notes
- **iOS**: Follow HIG navigation, native modals
- **Android**: Material Design navigation, Material modals
- Maintain consistent experience while respecting platform conventions