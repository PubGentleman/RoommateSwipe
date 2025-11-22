# Overview

RoomieMatch is a React Native mobile application built with Expo that connects renters, hosts, and agents/landlords in the roommate-finding marketplace. The app features role-based navigation, swipe-based roommate matching (similar to dating apps), property listings, group formation, and messaging capabilities. It serves as an "Airbnb for roommates," facilitating connections between people looking for housing and those offering it.

# User Preferences

Preferred communication style: Simple, everyday language.

**Code Organization Standards:**
- Always prefer simple solutions
- Avoid code duplication by checking existing implementations
- Keep files under 200-300 lines of code; refactor when exceeded
- Be careful to only make requested changes or well-understood related changes
- Never add stubbing or fake data patterns for dev/prod environments
- Maintain clean, organized codebase structure
- Avoid writing one-time scripts in persistent files

**Change Management:**
- When fixing bugs, exhaust all options with existing implementation before introducing new patterns
- If introducing new patterns, remove old implementation completely
- Never overwrite .env files without confirmation

# System Architecture

## Frontend Architecture

**Framework & Platform:**
- React Native 0.81.5 with Expo 54.0.23
- TypeScript for type safety
- React 19.1.0 with experimental React Compiler enabled
- New Architecture enabled for improved performance
- Cross-platform support (iOS, Android, Web)

**Navigation Structure:**
- React Navigation v7 with native stack and bottom tabs
- Role-based navigation with three distinct user flows:
  - **Renter**: 5 tabs (Explore, Roommates, Groups, Messages, Profile)
  - **Host**: 4 tabs (My Listings, Applications, Messages, Profile)
  - **Agent/Landlord**: 5 tabs (Properties, Verification, Documents, Messages, Profile)
- Transparent header with blur effects (iOS) using `expo-blur`
- Custom header components with app icon and title

**UI/UX Design Patterns:**
- Theme system supporting light/dark modes via `useTheme` hook
- Consistent design tokens in `/constants/theme.ts` (colors, spacing, typography, border radius)
- Reusable themed components (`ThemedView`, `ThemedText`)
- Custom wrapper components for safe area handling:
  - `ScreenScrollView` - Standard scrollable content
  - `ScreenKeyboardAwareScrollView` - Keyboard-aware scrolling
  - `ScreenFlatList` - List rendering with proper insets
- Platform-specific optimizations (iOS blur effects, Android edge-to-edge)

**Core Features by Role:**

*Renter Features:*
- Swipe-based roommate matching interface (Tinder-style) with reciprocal matching
- Automatic conversation creation from matches
- Real-time 1-on-1 messaging with matched roommates
- Group creation from conversations with multiple matches
- Property exploration and search
- Roommate group browsing with "My Groups" and "All Groups" sections
- Saved properties functionality

*Host Features:*
- Property listing management with CRUD operations
- Application review and approval workflow
- Active/inactive listing status management
- Property analytics (views, applications)

*Agent Features:*
- Multi-property portfolio management
- Document verification system
- Legal template library
- Professional credential verification

**Animation & Gestures:**
- Reanimated v4 for high-performance animations
- Gesture Handler for swipe interactions
- Spring animations with custom configurations
- Haptic feedback integration via `expo-haptics`
- Worklets for UI thread animations

**State Management:**
- React Context API for authentication (`AuthContext`)
- Local component state with hooks
- AsyncStorage for persistent auth data

## Authentication & Authorization

**Authentication Flow:**
- SSO support (Apple/Google) planned with email fallback
- Currently mock authentication implementation
- Role selection during login (renter/host/agent)
- Persistent sessions via AsyncStorage
- Loading states with activity indicators

**User Model:**
```typescript
{
  id: string
  email: string
  name: string
  role: 'renter' | 'host' | 'agent'
  profilePicture?: string
}
```

**Authorization:**
- Role-based navigation rendering
- Conditional screen access based on user role
- Role badges with distinct colors (renter: blue, host: green, agent: purple)

## Data Layer

**Current Implementation:**
- Mock data in `/utils/mockData.ts` for all entity types
- TypeScript interfaces in `/types/models.ts` defining data structures

**Data Models:**
- `RoommateProfile` - User profiles with lifestyle preferences, budget, compatibility scores
- `Property` - Rental listings with amenities, photos, pricing
- `Group` - Roommate groups with member management
- `Conversation` - Messaging threads with participants and messages array
- `Message` - Individual chat messages with sender, text, timestamp
- `Match` - Reciprocal matches between two users with matchedAt timestamp
- `Application` - Tenant applications for properties

**Matching & Messaging Implementation:**
- **Reciprocal Matching**: Users must mutually like each other before a match is created
  - `StorageService.addLike()` stores individual likes
  - `StorageService.checkReciprocalLike()` verifies both users have liked each other
  - `StorageService.addMatch()` creates a match only when reciprocal like is detected
- **Automatic Conversation Creation**: Conversations are auto-created from matches
  - `MessagesScreen.loadConversations()` checks for matches and creates missing conversations
  - Each conversation includes the participant profile, messages array, and timestamp
- **Message Persistence**: All messages and conversations persist in AsyncStorage
  - Timestamp serialization/deserialization handled by `StorageService.getConversations()`
  - Both conversation timestamps and message timestamps converted to Date objects on load
  - Messages sorted by timestamp within conversations
- **Initial Match Seeding**: For testing and demo purposes
  - `StorageService.seedInitialMatches()` creates 2 initial matches when renters first log in
  - Seeded matches with profiles '1' (Sarah Johnson) and '2' (Michael Chen)
  - Prevents empty state for new users and enables immediate testing of messaging flow

**Future Database Integration:**
- Designed to accommodate SQL database (note: Postgres may be added)
- Separate environments planned (dev, test, prod)
- No JSON file storage for production data

## Key Technical Decisions

**Module Resolution:**
- Babel module resolver with `@/` alias pointing to root
- Simplifies imports across the codebase
- TypeScript path mapping configured in `tsconfig.json`

**Platform-Specific Handling:**
- Keyboard controller only on native (falls back to standard ScrollView on web)
- Blur effects use native APIs on iOS, solid backgrounds on Android/web
- Separate color schemes and rendering for iOS/Android/web

**Performance Optimizations:**
- New Architecture enabled for improved rendering
- React Compiler for automatic optimizations
- Reanimated on UI thread for smooth animations
- Gesture-driven interactions with native performance

**Error Handling:**
- Error boundary component wrapping entire app
- Development-mode error details with stack traces
- Graceful fallback UI for production errors
- App reload functionality on critical errors

**Development Environment:**
- Replit-specific configuration in scripts and package.json
- Custom dev command with proxy URL configuration
- Expo Web Browser integration for OAuth flows
- ESLint with Prettier for code quality

# External Dependencies

**Core Framework:**
- `expo` - Development platform and SDK
- `react-native` - Mobile framework
- `react-navigation` - Navigation library (native stack, bottom tabs, elements)

**UI Components & Styling:**
- `expo-blur` - Native blur effects
- `expo-symbols` - System symbols
- `@expo/vector-icons` - Icon library (Feather icons)
- `react-native-safe-area-context` - Safe area handling
- `expo-system-ui` - System UI control

**Animations & Gestures:**
- `react-native-reanimated` - High-performance animations
- `react-native-gesture-handler` - Touch gesture handling
- `react-native-worklets` - UI thread JavaScript execution
- `expo-haptics` - Tactile feedback

**Storage & State:**
- `@react-native-async-storage/async-storage` - Persistent key-value storage

**Utilities:**
- `expo-linking` - Deep linking
- `expo-web-browser` - In-app browser
- `expo-constants` - App constants
- `expo-splash-screen` - Splash screen control
- `expo-image` - Optimized image component
- `react-native-keyboard-controller` - Keyboard behavior management

**Development Tools:**
- `typescript` - Type checking
- `eslint` with `eslint-config-expo` - Linting
- `prettier` - Code formatting
- `babel-plugin-module-resolver` - Import aliasing

**Planned Integrations:**
- Elasticsearch for search functionality (via Elastic.co hosting with dev/prod indexes)
- SQL database for production data storage
- SSO providers (Apple, Google)