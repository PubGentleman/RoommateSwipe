# Overview

Rhome is a React Native mobile application designed to simplify housing and roommate searches. It connects renters and hosts through a role-based, swipe-based matching platform, offering AI-powered matching, property listings, group functionalities, and secure communication. The project aims to become the leading platform for seamless housing and roommate discovery.

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

## Frontend

The application uses React Native, Expo, and TypeScript, with React Navigation for role-based access (Renter, Host, Agent/Landlord). It supports light/dark modes, animations with React Native Reanimated, and state management via React Context API and AsyncStorage.

**Key Features:**
- **Matching & Profiles:** Compatibility algorithms, interest tags, personality quizzes, and location matching.
- **Role-Specific Features:**
    - **Renter:** Swipe-based matching, 1-on-1 messaging, group management, property exploration with advanced filters, saved properties, AI Match Assistant, property reviews, and chat scheduling. Features an "Renter Intent System" for tailored onboarding.
    - **Host:** Dashboard for listing management (create, edit, delete, boost), inquiry handling, analytics, property review management, and group matches monetization. Supports Individual, Company, and Agent host types with features like Rhome Select Badge, Company Teams, and Group Bookings.
- **AI-Powered Enhancements:** AI Assistant for personalized housing help, AI-generated match explanations, group and listing suggestions, AI tools for agents/companies, AI-suggested meetups, and AI Neighborhood Intelligence using real-time data.
- **Pi AI Matchmaker:** An AI matchmaker persona providing insights, deck rankings, host recommendations, and preference parsing, integrated with a subscription-tiered usage system.
- **Pi Demand Intelligence:** Anonymous renter activity tracking feeds market context into Pi's listing advisor mode, aggregating neighborhood and listing demand.
- **Contact Info Protection:** Platform-level contact info blurring in chat messages for free users, with auto-unlocking upon confirmed actions.
- **Agent/Company Messaging Paywall:** Free-tier agents and companies have blurred message previews, with paid plans granting full access.
- **Verification & Safety:** Instagram verification, multi-photo enforcement, chat leakage detection, background checks, identity verification, a References System, Agent License Verification, **Agent/Company Email Domain Blocking** (personal emails blocked at signup with support contact flow; `blocked_email_domains` + `whitelisted_emails` tables, DB trigger on `auth.users`), and **Email Verification + Forgot Password** (post-signup verification pending screen with resend/cooldown/polling, dedicated forgot password flow with ForgotPasswordScreen → ResetEmailSentScreen → NewPasswordScreen, PASSWORD_RECOVERY deep link handling).
- **Profile Pause ("I Found a Place"):** Renters can pause their search profiles.
- **Activity Decay Ranking:** Inactive users' profiles progressively sink in discovery surfaces.
- **Boost System:** A tier-based system to increase visibility for listings and profiles.
- **Account Management:** Soft-delete functionality.
- **Subscription Management:** Tiered subscription plans for renters, hosts, and agents with a hybrid payment architecture.
- **UI/UX:** Consistent dark theme, collapsible/sticky headers, platform-specific interactions, and a comprehensive location system with Area Info Cards.
- **Renter/Host Mode Switch:** Allows individual hosts to toggle between modes.
- **Affiliate Program:** Users can apply to become affiliates with unique referral codes and a dedicated dashboard.
- **Request to Join Group:** Renters can browse and send join requests to open groups.
- **Couple & Room-Matching System:** Groups support couple members sharing one bedroom, with utility functions for managing room needs and group composition. Listings have a computed `rooms_available` column. Group inquiry functionality is dynamically enabled/disabled based on group-listing compatibility.
- **Household Gender Preference:** Collected during roommate onboarding (step 5 of 6), saved to both `users` and `profiles` tables. Used for bidirectional swipe feed filtering (hard filter for explicit preferences). Displayed in ProfileCompletionCard. Pi AI reads this field for matching context.
- **Amenity System:** Centralized amenity definitions in `constants/amenities.ts` provide a single source of truth, supporting categorized display, host listing creation, renter preferences, and legacy amenity normalization.
- **Host Badge System:** Three earned achievement badges (Rhome Select, Top Agent, Top Company) signal host quality, with criteria-based progression and daily recalculation via an Edge Function.
- **Apartment Seeker Group System:** Redesigned group experience with an invite system (email/phone, couple option, deep linking), shared liked listings (shortlist with real-time sync and member avatars), and tour scheduling with RSVP functionality.

## Backend

Supabase provides the complete backend infrastructure:
- **Auth:** Email/password authentication with Row Level Security (RLS).
- **Database:** PostgreSQL with RLS, computed columns, and preference tables.
- **Realtime:** Subscriptions for messaging and notifications.
- **Storage:** For media assets.
- **Edge Functions:** Used for webhooks, verification, background checks, payments, references, AI operations, match score calculations, group-to-listing matching, and public forms.

## Technical Decisions

The architecture includes a Babel module resolver, platform-specific UI, performance optimizations (React Native's New Architecture, React Compiler, Reanimated), and robust error handling. Navigation uses separate stack navigators with history behavior, and efficient data fetching prevents N+1 issues.

# External Dependencies

- `expo`
- `react-native`
- `react-navigation`
- `@react-native-community/datetimepicker`
- `react-native-reanimated`
- `@stripe/stripe-react-native`
- `react-native-purchases` (RevenueCat)
- `@react-native-async-storage/async-storage`
- `react-native-maps`
- `react-native-google-places-autocomplete`
- `react-native-webview`
- Supabase (Auth, Database, Realtime, Storage, Edge Functions)
- Claude (for AI operations)
- Walk Score API
- Overpass API
- NYC Open Data