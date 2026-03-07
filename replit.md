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

Roomdr utilizes a comprehensive points-based compatibility system (0-100 score) across 12 weighted factors, including location (neighborhood proximity), budget, sleep schedule, cleanliness, and lifestyle tags. It provides detailed breakdowns with strengths, concerns, and notes for each match, dynamically color-coding compatibility. Date of Birth is a required field for all users, driving an automatic Zodiac sign calculation, which contributes a minor weight to compatibility.

## Frontend Architecture

The application is built with React Native and Expo, using TypeScript and leveraging React Navigation for role-based navigation (Renter, Host, Agent/Landlord). It features a theme system for light/dark modes and reusable UI components.

**Core Features by Role:**
- **Renter:** Swipe-based matching, 1-on-1 messaging, group management, property exploration with advanced filters and list/map toggle view, saved properties, rewind functionality, profile views tracking, an AI Match Assistant, animated match celebration modal, report/block system, and notification feed with badge. Includes "room type" and "existing roommate gender" for listings, and compatibility scores with hosts.
- **Host:** Property listing management (CRUD), including room type and existing roommate gender tracking, application review, and listing status control.
- **Agent:** Multi-property portfolio management, document verification, and legal template library.

**Match Celebration:** When two users mutually like each other, an animated full-screen "It's a Match!" overlay appears (`components/MatchCelebrationModal.tsx`) with both users' photos, compatibility %, confetti particles, and action buttons (Send Message / Keep Swiping).

**Report/Block System:** Users can report (with reasons: Inappropriate, Fake profile, Harassment, Spam, Other) or block other users from swipe cards and chat screens (`components/ReportBlockModal.tsx`). Blocked users are filtered from the swipe deck, messages list, and notifications. A "Blocked Users" management screen is accessible from Privacy & Security settings (`screens/shared/BlockedUsersScreen.tsx`).

**Notification System:** The `NotificationContext` (`contexts/NotificationContext.tsx`) provides app-wide notification state with unread count, real-time toast alerts, and automatic polling every 5 seconds. Red badges appear on both Messages and Profile tabs across all roles (Renter, Host, Agent). The `NotificationToast` component (`components/NotificationToast.tsx`) shows animated slide-down banners with haptic feedback for new notifications. The Profile screen's Notifications menu item shows a badge count. Notifications are generated for matches, super likes, messages, group events, and property updates. Tapping a notification navigates to the relevant screen (chat, groups, explore). Blocked user notifications are filtered out.

Animations are handled by React Native Reanimated, and gestures by React Native Gesture Handler. State management uses React Context API and AsyncStorage for persistence.

## Authentication & Authorization

The current implementation uses mock authentication with email/password stored in AsyncStorage for demonstration purposes only, lacking real security features like hashing or salting. It supports role-based navigation and conditional screen access for `renter`, `host`, and `agent` roles. Three subscription tiers (Basic, Plus, Elite) are implemented via Stripe integration, offering varying levels of features like messaging limits, rewinds, profile insights, and advanced filters. Privacy settings (profile visibility, online status) and account deletion are implemented. The system has planned SSO integration.

## Data Layer

The current data layer uses mock data and TypeScript interfaces for models such as `RoommateProfile`, `Property`, `Group`, `Conversation`, `Message`, `Match`, and `Application`. It supports reciprocal matching, automatic conversation creation, and message limits. Property management includes distinguishing between 'room' and 'entire' room types, tracking existing roommates, linking to host profiles for compatibility, and managing property rental status. Location data for renters automatically includes neighborhood, city, state, and coordinates. An AI Match Assistant uses micro-questions to refine user profiles, parsing natural language responses to update preferences.

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
- `react-native-maps` (iOS/Android native maps; web shows fallback property list)

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