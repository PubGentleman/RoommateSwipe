# Overview

Roomdr is a React Native mobile application built with Expo, designed to connect renters, hosts, and agents/landlords in the roommate-finding marketplace. It aims to be an "Airbnb for roommates," offering features such as role-based navigation, swipe-based roommate matching, property listings, group formation, and messaging capabilities to streamline the housing and roommate search process.

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

## Matching Algorithm

Roomdr utilizes a comprehensive points-based compatibility system (0-100 score) across 14 weighted factors, including location (neighborhood proximity), budget, sleep schedule, cleanliness, move-in timeline alignment, shared expense expectations, and lifestyle tags. It provides detailed breakdowns with strengths, concerns, and notes for each match, dynamically color-coding compatibility. Date of Birth is a required field for all users, driving an automatic Zodiac sign calculation, which contributes a minor weight to compatibility. Move-in timeline matching (6 points) penalizes or rewards based on how closely two renters' dates align: within 2 weeks = 6pts, within a month = 5pts, 2 months = 3pts, 3 months = 1pt, 3+ months = 0pts. Shared expense expectations (2 points) compare preferences on utilities, groceries, internet, and cleaning supplies splitting — 75%+ match = 2pts, 50%+ = 1pt, below 50% = 0pts.

## Frontend Architecture

The application is built with React Native and Expo, using TypeScript and leveraging React Navigation for role-based navigation (Renter, Host, Agent/Landlord). It features a theme system for light/dark modes and reusable UI components.

**Core Features by Role:**
- **Renter:** Swipe-based matching, 1-on-1 messaging, group management, property exploration with advanced filters and list/map toggle view, saved properties, rewind functionality, profile views tracking, an AI Match Assistant, animated match celebration modal, report/block system, notification feed with badge, and profile completion indicator. Includes "room type" and "existing roommate gender" for listings, and compatibility scores with hosts. The Match screen uses a dark Tinder-style design (#141414 background) with the `RoomdrLogo` component (horizontal, small) in the header, full-height card with LinearGradient overlay, horizontal photo bar indicators, dark glass pill tags (budget, work type, location) + coral match % tag, native-style sponsored ad banner, and 5 transparent-background action buttons with colored borders (undo, pass/red, message/pink, star/blue, like/green).
- **Host:** Property listing management (CRUD), including room type and existing roommate gender tracking, application review, and listing status control.
- **Agent:** Multi-property portfolio management, document verification, and legal template library.

**Match Celebration:** When two users mutually like each other, an animated full-screen "It's a Match!" overlay appears (`components/MatchCelebrationModal.tsx`) with both users' photos, compatibility %, confetti particles, and action buttons (Send Message / Keep Swiping).

**Profile Questionnaire:** The `ProfileQuestionnaireScreen` (`screens/shared/ProfileQuestionnaireScreen.tsx`) replaces the old single-page EditProfile form with a 13-step guided questionnaire. One question per screen with smooth slide animations between steps. Features a progress bar at top, large tap-to-select `SelectionCard` components (`components/questionnaire/SelectionCard.tsx`) instead of dropdowns/small pills, and proper keyboard avoidance for text input steps. Steps: Photos, Basic Info (name/email/DOB/interests), Gender, Location & Work, Bio, Sleep Schedule, Cleanliness, Smoking, Social (guests + noise), Work & Pets, Housing (budget/type/move-in/bedrooms), Lifestyle (multi-select up to 3), Shared Expenses (4 categories). The `ProgressBar` component (`components/questionnaire/ProgressBar.tsx`) shows animated step progress. Final step shows "Save Profile" which calls `updateUser()` with all collected data. The old `EditProfileScreen` is still accessible but navigation from Profile screen now goes to the questionnaire.

**Report/Block System:** Users can report (with reasons: Inappropriate, Fake profile, Harassment, Spam, Other) or block other users from swipe cards and chat screens (`components/ReportBlockModal.tsx`). Blocked users are filtered from the swipe deck, messages list, and notifications. A "Blocked Users" management screen is accessible from Privacy & Security settings (`screens/shared/BlockedUsersScreen.tsx`).

**Notification System:** The `NotificationContext` (`contexts/NotificationContext.tsx`) provides app-wide notification state with unread count, real-time toast alerts, and automatic polling every 5 seconds. Red badges appear on both Messages and Profile tabs across all roles (Renter, Host, Agent). The `NotificationToast` component (`components/NotificationToast.tsx`) shows animated slide-down banners with haptic feedback for new notifications. The Profile screen's Notifications menu item shows a badge count. Notifications are generated for matches, super likes, messages, group events, and property updates. Tapping a notification navigates to the relevant screen (chat, groups, explore). Blocked user notifications are filtered out. The `NotificationPreferencesScreen` (`screens/shared/NotificationPreferencesScreen.tsx`) allows users to configure which notification types they receive (matches, super likes, messages, group invitations, group updates, property updates, boost reminders). System alerts cannot be disabled. Preferences are persisted in `user.notificationPreferences` and enforced in `StorageService.addNotification`, which checks the recipient's preferences before storing a notification.

**Profile Completion Indicator:** The `ProfileCompletionCard` component (`components/ProfileCompletionCard.tsx`) displays on the renter's Profile screen under a "Profile Strength" section. It tracks 10 weighted fields (photo, bio, birthday, budget, location, occupation, interests, sleep schedule, cleanliness, smoking) and shows an animated progress bar, percentage badge, encouragement text, and up to 3 actionable missing-field suggestions with tips (e.g., "Add a photo to get 3x more matches"). Tapping a suggestion navigates to Edit Profile. When 100% complete, it shows a compact "Profile Complete" confirmation.

**Identity Verification System:** The `VerificationScreen` (`screens/shared/VerificationScreen.tsx`) allows users to verify their identity via three methods: phone number (SMS code), government ID (upload), and social media (Instagram, LinkedIn, Facebook). The `VerificationBadge` component (`components/VerificationBadge.tsx`) displays verification status badges across the app — on swipe cards (blue "Verified" badge in the badges row), in the profile detail modal (inline verified tag next to name), and on the user's own Profile screen (next to name). Verification levels: 0 = Not Verified, 1 = Partially Verified, 2 = Verified, 3 = Fully Verified. Verification data is stored in `user.verification` (type `VerificationStatus`) and `RoommateProfile.verification`. The Profile screen's Account section has a "Verify Your Identity" menu item showing progress (X/3). Verified profiles are intended to get more engagement and build trust.

**Onboarding Tutorial Flow:** New users see a 5-page swipeable tutorial (`screens/shared/OnboardingScreen.tsx`) after their first login, explaining: Welcome, Swipe to Match, Smart Compatibility (14 factors), Form Groups, and Ready to Start. Users can skip or progress through pages. Completion is persisted per-user via `StorageService.isOnboardingCompleted(userId)` / `setOnboardingCompleted(userId)` in AsyncStorage (keyed by user ID). The `RootNavigator` checks this flag after authentication and before rendering the main tab navigator. Returning users skip onboarding automatically.

Animations are handled by React Native Reanimated, and gestures by React Native Gesture Handler. State management uses React Context API and AsyncStorage for persistence.

## Authentication & Authorization

The current implementation uses mock authentication with email/password stored in AsyncStorage for demonstration purposes only, lacking real security features like hashing or salting. It supports role-based navigation and conditional screen access for `renter`, `host`, and `agent` roles. Three subscription tiers (Basic, Plus, Elite) are implemented via Stripe integration, offering varying levels of features like messaging limits, rewinds, profile insights, and advanced filters. Privacy settings (profile visibility, online status) and account deletion are implemented. The system has planned SSO integration.

## Data Layer

The current data layer uses mock data and TypeScript interfaces for models such as `RoommateProfile`, `Property`, `Group`, `Conversation`, `Message`, `Match`, and `Application`. It supports reciprocal matching, automatic conversation creation, and message limits. Property management includes distinguishing between 'room' and 'entire' room types, tracking existing roommates, linking to host profiles for compatibility, and managing property rental status. Location data for renters automatically includes neighborhood, city, state, and coordinates. An AI Match Assistant uses micro-questions to refine user profiles, parsing natural language responses to update preferences.

## Branding & Logo

The `RoomdrLogo` component (`components/RoomdrLogo.tsx`) renders the brand logo using `react-native-svg` for the house icon and `expo-linear-gradient` for the icon background. Supports three variants: `horizontal` (icon + wordmark side by side), `stacked` (icon above wordmark with optional tagline), and `icon-only`. Three sizes: `sm`, `md`, `lg`. Brand colors: coral-red gradient `#ff6b5b` to `#e83a2a` for icon box, white house silhouette, wordmark in white with "dr" in coral `#ff6b5b`. Used in: Match screen header (horizontal/sm), Onboarding welcome page (stacked/lg with tagline), Login screen (horizontal/md). App icon, favicon, and splash icon are AI-generated with matching coral-red gradient + white house. Splash background: `#141414`.

## Location Privacy & Filtering

Public property displays enforce location privacy by showing only "{neighborhood}, {city}". Full street addresses are not displayed publicly. The ExploreScreen defaults to city-based property filtering, relaxing this filter when specific city/neighborhood names are searched.

## Key Technical Decisions

Key technical decisions include Babel module resolver for simplified imports, platform-specific UI adaptations (iOS, Android, Web), performance optimizations using React Native's New Architecture, React Compiler, Reanimated, and gesture-driven interactions. Error handling is managed by an error boundary component.

# External Dependencies

**Core Framework:**
- `expo`
- `react-native`
- `react-navigation`

**UI Components & Styling:**
- `expo-blur`
- `expo-symbols`
- `@expo/vector-icons`
- `react-native-safe-area-context`
- `expo-system-ui`
- `@react-native-community/datetimepicker` (iOS/Android only)

**Animations & Gestures:**
- `react-native-reanimated`
- `react-native-gesture-handler`
- `react-native-worklets`
- `expo-haptics`

**Storage & State:**
- `@react-native-async-storage/async-storage`

**Maps:**
- `react-native-maps` (iOS/Android native maps)
- Web map: Leaflet/OpenStreetMap via iframe with `srcDoc` (no native dependency needed)
- `react-native-webview` (installed for potential native WebView usage)

**Utilities:**
- `expo-linking`
- `expo-web-browser`
- `expo-constants`
- `expo-splash-screen`
- `expo-image`
- `react-native-keyboard-controller`

**Monetization:**
- `AdBanner` component (`components/AdBanner.tsx`) - Placeholder ad system ready for Google AdMob
- Currently shows dashed placeholder boxes in development
- To activate: Install `react-native-google-mobile-ads`, replace placeholders with real BannerAd components
- Ad placements: Between swipe card and action buttons on Match screen and Groups discover screen
- Supported sizes: banner (320x50), largeBanner (320x100), mediumRectangle (300x250), fullBanner (468x60), leaderboard (728x90)

**Development Tools:**
- `typescript`
- `eslint`
- `prettier`
- `babel-plugin-module-resolver`