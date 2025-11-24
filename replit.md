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

Roomdr utilizes a comprehensive points-based compatibility system (0-100 score) across 12 weighted factors, with location being a major determinant through neighborhood proximity mapping. It provides detailed breakdowns with strengths, concerns, and notes for each match. Key factors include Location, Budget, Sleep Schedule, Cleanliness, Smoking/Substances, Work Location, Guest Policy, Noise Tolerance, Pets, Roommate Relationship, Lifestyle Tags, and Zodiac Sign (optional). The system calculates scores in real-time and dynamically color-codes compatibility (Green 80%+, Blue 70%+, Orange 60%+, Red <60%). Note: Occupation scoring was removed to accommodate zodiac while maintaining the 100-point total.

**Zodiac Sign Matching:**
- Optional field allowing users to select from 12 Western zodiac signs (Aries through Pisces)
- Light weight in compatibility algorithm (2 points max, ~1-2% of total score)
- Only applies when both users have zodiac signs selected
- Element-based compatibility: Fire, Earth, Air, Water
- Premium feature: Plus/Elite users see detailed zodiac compatibility insights in profile detail view
- Displays as "Age · ♌ Leo" format in profile cards when present

## Frontend Architecture

The application is built with React Native and Expo, using TypeScript and leveraging React's experimental features for performance. It employs React Navigation for a role-based navigation structure (Renter, Host, Agent/Landlord) with nested navigators. UI/UX follows a theme system supporting light/dark modes and uses reusable, themed components.

**Core Features by Role:**
- **Renter:** Swipe-based matching with priority visibility (Elite), 1-on-1 messaging, Priority messaging (Elite users can message without matching; Basic users can pay $0.99 for single message), comprehensive group management, property exploration with advanced filters (Plus/Elite only), saved properties, rewind functionality (1/day for Basic, 5/day for Plus, unlimited for Elite), profile views tracking (Plus/Elite), see who liked you (Elite only), and an AI Match Assistant (Plus/Elite). Boost feature available for profile visibility. Property listings display room type (ROOM vs ENTIRE APARTMENT), existing roommate gender for room listings, and compatibility scores with hosts for informed decision-making.
- **Host:** Property listing management (CRUD) with room type specification (room or entire apartment), existing roommate gender tracking for room listings, application review, listing status control, and featured listings (Elite only).
- **Agent:** Multi-property portfolio management, document verification, legal template library, and professional credential verification.

Animations use React Native Reanimated, and gestures are handled by React Native Gesture Handler. State management relies on React Context API for authentication and local component state, with AsyncStorage for persistent data.

## Authentication & Authorization

**⚠️ DEMO AUTHENTICATION ONLY**: This app uses mock authentication with plaintext passwords stored in AsyncStorage. This is **for demonstration purposes only** and provides no real security. Production deployment would require a proper backend server with secure credential hashing, salting, and validation.

The system implements mock authentication with email/password (simple string comparison, no hashing - for demonstration only) and has planned SSO (Apple/Google) integration. Password persistence and privacy settings are fully functional and persist across sessions. Users have defined roles (`renter`, `host`, `agent`) with role-based navigation and conditional screen access. Three subscription tiers are implemented via Stripe integration: Basic (Free), Plus ($14.99/month), and Elite ($49.99-$99/month). Subscription management includes full lifecycle support for cancellation, downgrades, and reactivation with prorated access and clear UI indicators.

**Privacy & Security Features (Demo Implementation):**
- Password management: Users can change passwords with validation (8+ character minimum, confirmation matching). Passwords stored in plaintext in AsyncStorage.
- Privacy settings: Profile visibility, online status display, last active time display (all persist to storage)
- Two-factor authentication toggle (UI-only, persists preference but no OTP implementation)
- Account deletion: Comprehensive cleanup of all user data from AsyncStorage (users, profiles, conversations, matches, likes, notifications, groups, etc.)

**Future Backend Requirements:**
- Secure password hashing (bcrypt/argon2) and salting
- Server-side credential validation
- Real OTP generation for 2FA
- Secure session management with JWT tokens
- API-based authentication flow

**Subscription Tiers:**

**Basic (Free):**
- Unlimited messages (must match first)
- 3 active chats maximum
- 1 free rewind per day
- Create 1 group
- Join 1 group
- Browse listings
- Basic features

**Plus ($14.99/month):**
- Unlimited messages
- 10 active chats
- 5 rewinds per day
- See who viewed your profile
- Unlimited groups
- Advanced filters
- Walk Score access
- Online status visibility
- AI match assistant
- 1 boost per week

**Elite ($49.99-$99/month):**
- Unlimited messages
- Unlimited chats
- Unlimited rewinds
- See who liked you
- Priority visibility in swipe queue
- Boosted matching access
- Priority messaging (message without matching)
- Featured listings (for hosts/agents)
- AI match assistant
- All Plus features included

**Walk Score Feature:**
- Walk Score displays walkability ratings (0-100) for properties with color-coded scores and official-style circular green badge with walking person icon
- Basic users see lock icons on property listings with upgrade prompts
- Plus and Elite users have full access to Walk Score data across all property views
- Hosts and agents always see Walk Scores on their own listings regardless of subscription tier
- Score color-coding: green (90-100), lime green (80-89), yellow (70-79), orange (50-69), red-orange (25-49), dark red (0-24)

## Data Layer

The current implementation uses mock data and TypeScript interfaces for data models such as `RoommateProfile`, `Property`, `Group`, `Conversation`, `Message`, `Match`, and `Application`. The User model tracks `messageCount` and `boostData`. It implements reciprocal matching, automatic conversation creation, and enforces message limits. Group management includes swipeable discovery and a request-to-join workflow. Property management handles featured status, host listing filtering, room type differentiation (room vs entire apartment), existing roommate gender tracking, and host profile linking for compatibility calculations. The architecture is designed for future integration with a SQL database.

**Property Model Enhancements:**
- `roomType`: Distinguishes between 'room' (single room in shared apartment) and 'entire' (entire apartment). **Note:** Studios should be listed as 'entire' unless the host is sharing the bedroom with another person (2+ people in same bedroom).
- `existingRoommates`: Array tracking all current household members with fields for gender, onApp status, and userId for those with accounts
- `hostProfileId`: Links to host's User profile for compatibility score calculation using the matching algorithm
- `propertyType`: Distinguishes between 'lease' (long-term) and 'sublet' (short-term) arrangements
- `available`: Boolean indicating if property is available for rent (false when marked as rented)
- `rentedDate`: Date when property was marked as rented, used for record keeping

**Property Rental Status System:**
- Hosts and agents can mark properties as rented via action buttons in their listing screens
- Marking a property as rented sets `available: false`, records `rentedDate`, and removes it from ExploreScreen
- Automatically sends `property_rented` notifications to all users who saved the property
- Hosts and agents can mark rented properties back as available, restoring them to ExploreScreen
- Marking as available sets `available: true`, clears `rentedDate`, and makes property visible again
- Rental status persists across app restarts via improved data initialization guards

**Data Persistence & Initialization:**
- `initializeWithMockData()` checks for existing data before overwriting, preserving modifications like rental status
- `forceReloadMockData()` available for intentional reset of all mock data
- Notification ID generation uses `generateNotificationId()` with timestamp + counter + random component for collision resistance

**User Model Location Data:**
- Renter users automatically receive `profileData` with location fields (neighborhood, city, state, coordinates) on registration, login, and app load
- Default location set to Williamsburg, Brooklyn for new renters
- Location data is backfilled for existing users on app load to ensure city-based filtering works across all sessions

## Location Privacy & Filtering

**Location Privacy Enforcement:**
- Public property displays show only "{neighborhood}, {city}" format via the `formatLocation()` utility
- Street addresses are never displayed in public views (Explore screen, property cards, detail modals)
- Full addresses remain accessible to hosts for their own listings

**City-Based Filtering:**
- ExploreScreen defaults to showing properties only in the user's city
- Filter automatically relaxes when searching for specific city/neighborhood names
- Uses `getAllCities()` from locationData.ts for maintainable city list
- Prevents location-irrelevant results while allowing targeted location searches

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

**Animations & Gestures:**
- `react-native-reanimated`
- `react-native-gesture-handler`
- `react-native-worklets`
- `expo-haptics`

**Storage & State:**
- `@react-native-async-storage/async-storage`

**Utilities:**
- `expo-linking`
- `expo-web-browser`
- `expo-constants`
- `expo-splash-screen`
- `expo-image`
- `react-native-keyboard-controller`

**Development Tools:**
- `typescript`
- `eslint`
- `prettier`
- `babel-plugin-module-resolver`

**Planned Integrations:**
- Elasticsearch
- SQL database (e.g., Postgres)
- SSO providers (Apple, Google)