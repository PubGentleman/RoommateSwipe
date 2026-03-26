# Overview

Rhome is a React Native mobile application designed to simplify housing and roommate searches. It connects renters and hosts through a role-based, swipe-based matching platform. The project aims to provide a comprehensive and intuitive solution, akin to "Airbnb for roommates," facilitating the discovery of compatible roommates and suitable properties. Key capabilities include AI-powered matching, property listings, group functionalities, and secure communication.

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

The application is built using React Native, Expo, and TypeScript, utilizing React Navigation for role-based access (Renter, Host, Agent/Landlord). It supports light/dark modes, animations with React Native Reanimated, and state management via React Context API and AsyncStorage.

**Key Features:**
- **Matching & Profiles:** Features a compatibility algorithm, interest tags, and personality quizzes. Profile questionnaire removed from sign-up; replaced by a post-signup Profile Completion system (inline form in `screens/shared/ProfileCompletionScreen.tsx`).
- **Role-Specific Features:**
    - **Renter:** Swipe-based matching, 1-on-1 messaging, group management, property exploration with advanced filters and transit integration, saved properties, AI Match Assistant, property reviews, chat scheduling (visit requests + booking offers), and notifications.
    - **Host:** Dashboard for listing management (create, edit, delete, boost), inquiry handling, analytics, property review management with host replies, and group matches monetization. Supports Individual, Company, and Agent host types with varying UI/features.
    - **Property Reviews:** Renters can rate (1-5 stars) and review listings with optional text and tags (Clean, Responsive host, Great location, etc.). Reviews display in listing detail modal and full reviews screen. Hosts can reply to reviews. Rating badges appear on listing cards. DB: `property_reviews` table with RLS, `average_rating`/`review_count` on `listings`. Migration: `036_property_reviews.sql`. Files: `services/reviewService.ts`, `components/WriteReviewSheet.tsx`, `screens/shared/PropertyReviewsScreen.tsx`.
    - **Chat Scheduling & Booking:** In accepted inquiry chats, a "+" action menu offers "Schedule Visit" (all users) and "Send Booking Offer" (host only). Visit requests and booking offers render as rich action cards inline in chat with Confirm/Decline/Propose New Time actions. Cards update status in real-time via message metadata. Booking acceptance creates a record in the `bookings` table. DB: `message_type`/`metadata` columns on `messages`, `bookings` table with RLS. Migration: `037_chat_cards_bookings.sql`. Files: `services/bookingService.ts`, `components/ChatActionCard.tsx`, `components/VisitRequestModal.tsx`, `components/BookingOfferModal.tsx`.
    - **Rhome Select Badge:** Gold "award" badge displayed on listing cards and detail modal for top-rated hosts (average_rating >= 4.8 with 10+ reviews). Full eligibility model in `hooks/useRhomeSelect.ts` includes host tenure (3+ months), cancellation rate (<10%), and booking history. Badge appears on ExploreScreen cards and detail modal host section.
    - **Company Teams:** Multi-seat team access for company accounts with Owner/Admin/Member roles, invite system, seat limits by plan (Starter: 3, Pro: 10, Enterprise: unlimited), team management dashboard, and role-based permissions.
    - **Company Agent Assignment & Routing:** Company accounts can assign agents to listings via dropdown in CreateEditListingScreen. Messages/inquiries auto-route to the assigned agent. HostDashboardScreen shows Team Activity section with agent stats, expandable rows, filter buttons (All/Active/Pending/Confirmed), unassigned listing warning banner, and Reassign Agent modal. DB: `assigned_agent_id` on `listings`. Migration: `038_agent_assignment_group_bookings.sql`. Files: `services/listingService.ts` (getCompanyAgents, reassignListingAgent, getAgentStats, getCompanyListingsWithAgents), `services/groupService.ts` (routes to assigned agent).
    - **Verified Agent Badge:** Blue "Verified Agent" pill badge shown when `hostType=agent` AND `licenseVerified=true`. Displays in: listing detail host section (ExploreScreen), chat header (ChatScreen), visit request cards and booking offer cards (ChatActionCard). Company agents show company name below agent name on booking cards.
    - **Group Bookings:** Visit/booking action cards show "Group of X" count when in group chats. Only group leader (admin) can accept/decline visit requests and booking offers; non-leaders see "Only the group leader can respond" note. Booking creation stores `group_id` when in a group context. DB: `group_id` on `bookings`. Migration: `038_agent_assignment_group_bookings.sql`. Files: `components/ChatActionCard.tsx`, `services/bookingService.ts`.
    - **Agent Response Tracking & Company Alerts:** Tracks agent response times to renter messages in inquiry conversations. Status escalation: active (<24h), delayed (24h), unresponsive (48h), critical (72h). Renters see amber "Request a Different Agent" banner in chat at 48h+ with confirmation dialog. Company dashboard shows RESPONSE ALERTS section with yellow (delayed) and red (critical) indicators, agent name, wait time, listing info, and "Reassign Conversation" button for critical alerts. ExploreScreen listing cards show amber "Response Delayed" badge for agents with delayed/critical response status. Rhome Select eligibility requires response_rate >= 90%. Background hook runs hourly to check status, send notifications, and recalculate response rates. DB: `last_renter_message_at`, `last_agent_response_at`, `response_status`, `response_rate` on conversations/users. Migration: `039_response_tracking.sql`. Files: `services/responseTrackingService.ts`, `hooks/useResponseTracking.ts`, `screens/shared/ChatScreen.tsx`, `screens/host/HostDashboardScreen.tsx`, `screens/renter/ExploreScreen.tsx`, `hooks/useRhomeSelect.ts`.
- **AI-Powered Enhancements:**
    - **AI Assistant:** Context-aware assistant with persistent memory, powered by Claude via Supabase Edge Functions for personalized housing assistance and streaming responses.
    - **Match Explanations:** AI-generated breakdowns of compatibility scores for matches.
    - **Group & Listing Suggestions:** AI-driven renter suggestions for groups, "Best Match Today" banners, AI group health scores, and automated roommate/listing matching.
    - **Agent & Company Tools:** AI-powered shortlisting, group composition, pairing, and vacancy filling.
    - **Meetup Suggestions:** AI analyzes chat intent to suggest meetups at halfway points.
    - **Question of the Day:** AI-generated daily compatibility questions personalized for users.
    - **"Ask AI About This Person":** Multi-turn chat to inquire about other users with context-aware responses.
    - **AI Neighborhood Intelligence:** Provides AI-generated neighborhood briefings with local data from Walk Score and Google Places, with follow-up chat capabilities.
    - **Shareable Profile Notes:** Users can add free-text descriptions of themselves, which AI can leverage.
- **Verification & Safety:** Instagram verification, multi-photo enforcement, chat leakage detection, Safety Mode with background checks (via Persona), identity verification (Stripe Identity SDK), References System, and Agent License Verification (free state board scraping, document upload, verified/pending badges).
- **Agent License Verification:** State selector, license number input with helper text, optional document upload (PDF/photo via expo-document-picker) to private Supabase Storage bucket `license-documents` (stores object path, not public URL), free state licensing board scraping via Supabase Edge Function (`verify-agent-license`) covering 10 states (NY, FL, TX, CA, GA, NC, IL, AZ, NV, CO) with automatic fallback to manual review for unsupported states. Three verification result states: `verified` (green), `not_found` (red error with document upload prompt), `manual_review` (amber pending). DB fields: `license_state`, `license_document_url`, `license_verified`, `license_verified_at`, `license_verification_status`. Migrations: `034_agent_verification.sql`, `035_license_documents_bucket.sql`.
- **Benefit Callouts:** All host onboarding screens (HostTypeSelectScreen, HostAgentSetupScreen, HostCompanySetupScreen) display role-specific benefit lists below form fields.
- **Boost System:** Tier-based boosting for increased visibility of listings and profiles.
- **Account Management:** Soft-delete functionality with a recovery window.
- **Subscription Management:** Tiered subscription plans for renters, hosts, and agents, with bundled pricing and a hybrid payment architecture (RevenueCat for native, Stripe for web).
- **UI/UX:** Consistent dark theme, collapsible/sticky headers, and platform-specific adaptations.
- **Location System:** Explore screen location sheet uses search autocomplete (cities, neighborhoods, ZIP codes via expo-location geocoding) as primary input, with popular city chips as secondary discovery. Google Places Autocomplete used for onboarding and profile questionnaire via `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`. `locationData.ts` provides local city/neighborhood data for instant search results.
- **Area Info Cards:** Listing detail modal shows 5 area info category cards (Transit, Restaurants, Grocery, Laundromat, Parks) with real data from Overpass API (free, no key). Fetches nearby amenities within 500m radius using listing coordinates. Shows loading skeleton while fetching, graceful fallback on error. Results cached in memory. Laundromat card shows "In building" if listing has laundry amenity. Service: `services/neighborhoodService.ts`. Transit stops use Feather icons (no emojis).
- **Renter/Host Mode Switch:** Allows individual hosts to toggle between modes.

## Backend (Supabase)

Supabase provides the complete backend infrastructure:
- **Auth:** Email/password authentication with Row Level Security (RLS).
- **Database:** PostgreSQL with RLS, including computed columns for available rooms and a table for existing roommate preferences.
- **Realtime:** Subscriptions for messaging and notifications.
- **Storage:** For media assets like photos.
- **Edge Functions:** Used for webhooks (Stripe), verification, background checks, payments, references, AI operations (Claude), match score calculations, group-to-listing matching, and public forms.

## Subscription & Paywall System

A tiered subscription model exists for renters, hosts, and agents, complemented by one-time purchases. Host plans automatically include renter access. Payments are managed through RevenueCat for native iOS/Android (Apple IAP, Google Play Billing) and Stripe for web. RevenueCat webhooks sync subscription states to the Supabase database.

## Data Layer

Supabase PostgreSQL is the primary data store, with AsyncStorage for local caching. TypeScript interfaces define data models. A centralized `listingService.ts` manages CRUD operations. The group system handles roommate and listing inquiry groups with plan-based limits.

## Technical Decisions

The architecture includes a Babel module resolver, platform-specific UI, performance optimizations (React Native's New Architecture, React Compiler, Reanimated), and robust error handling. Navigation employs separate stack navigators with history behavior. Efficient data fetching prevents N+1 issues.

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
- `@react-native-community/datetimepicker`

**Animations & Gestures:**
- `react-native-reanimated`
- `react-native-gesture-handler`
- `react-native-worklets`
- `expo-haptics`

**Payments:**
- `@stripe/stripe-react-native`
- `react-native-purchases` (RevenueCat)
- `@replit/revenuecat-sdk`

**Storage & State:**
- `@react-native-async-storage/async-storage`

**Maps:**
- `react-native-maps`
- `react-native-google-places-autocomplete`
- `react-native-webview`

**Utilities:**
- `expo-linking`
- `expo-web-browser`
- `expo-constants`
- `expo-splash-screen`
- `expo-image`
- `react-native-keyboard-controller`