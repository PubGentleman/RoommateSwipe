# Overview

Rhome is a React Native mobile application that revolutionizes the housing and roommate search by connecting renters and hosts. It offers role-based navigation, swipe-based matching, property listings, group functionalities, and secure messaging. The platform aims to be an intuitive, comprehensive "Airbnb for roommates," providing a seamless solution for finding compatible roommates and suitable properties.

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

The application is built with React Native and Expo using TypeScript, leveraging React Navigation for role-based access (Renter, Host, Agent/Landlord). It supports light/dark modes, uses React Native Reanimated for animations and gestures, and manages state with React Context API and AsyncStorage.

**Key Features:**
- **Matching & Profiles:** Compatibility algorithm (0-100+ score) based on 16 weighted criteria, interest tag system, 14-step Profile Questionnaire, and a 5-question Personality Quiz.
- **Renter Features:** Swipe-based matching, 1-on-1 messaging, Roommate and Listing Inquiry group management, property exploration with advanced filters (including transit-aware matching with NYC subway integration) and map/list views, saved properties, AI Match Assistant, notification feed, and daily cold messaging limits.
- **Host Features:** Host dashboard, listing management (create, edit, delete, boost), inquiries screen, analytics, and group matches monetization. Host types (Individual, Company, Agent) affect UI and features.
- **AI-Powered Enhancements:**
    - **AI Assistant:** Context-aware floating button, AI Memory Layer (persistent `user_ai_memory` table), and AI Match Assistant powered by Claude (claude-sonnet-4-5) via Supabase Edge Functions with streaming SSE responses. Housing-focused quick actions (find matches, improve profile, neighborhoods, move-in timeline). Persistent memory extracts budget, dealbreakers, must-haves, neighborhoods, and lifestyle facts across sessions via background Haiku extraction. Streaming responses show characters in real-time as Claude types them.
    - **"Why This Match?" Modal:** Tap "Why?" next to compatibility score on swipe cards to get a Claude Haiku-generated breakdown with headline, top 3 reasons, concerns, and conversation starter. Results cached in `match_explanations` table via `explain-match` Edge Function.
    - **AI Renter Suggestions:** GroupInfoScreen shows compatible renter suggestions for groups.
    - **"Best Match Today" Banner:** Displays a top match in the RoommatesScreen swipe feed.
    - **AI Group Health Scores:** Calculates group compatibility and identifies conflicts, displayed with badges and snippets.
    - **Group Quick Stats:** Inline chip counts for suggested members and matching apartments on group cards.
    - **Automated AI Roommate Matching:** AI-generated group suggestions with invite flow and automatic listing matching upon group completion.
    - **Agent Matchmaker:** AI-powered renter shortlisting, group composition, compatibility matrix, group builder with invite flow, placement pipeline, and Claude AI Group Pairing for recommendations.
    - **Company Host AI Auto-Fill:** AI-powered vacancy fill system with group recommendations and invites for shortlisted renters.
    - **AI Meetup Suggestions:** After matched renters exchange 6+ messages, Claude analyzes conversation intent (or detects phone/Instagram sharing via regex) and proactively suggests a coffee shop meetup halfway between their neighborhoods. Uses `analyze-chat-intent` Edge Function, `meetup_suggestions` table (migration 025), `MeetupSuggestionCard` component with real-time response updates, Google Places API for venue suggestions, and push notifications.
    - **Question of the Day:** AI-generated daily compatibility question via `generate-daily-question` Edge Function (Claude Haiku). Questions are personalized based on user profile, AI memory, and recent question history to avoid repeats. Answers saved to `daily_questions` table (migration 029), merged into `personality_answers` on profiles, and stored in `user_ai_memory` via `answer-daily-question` Edge Function. `DailyQuestionCard` component displays above swipe deck in RoommatesScreen (and in empty deck state). Questions expire after 24h.
    - **"Ask AI About This Person":** Multi-turn chat modal (`AskAboutPersonModal`) accessible from 3 entry points: swipe card ("Ask AI" pill), match celebration screen ("Ask AI about [name]" button), and chat screen header (CPU icon). Context-aware opening messages and quick prompts per entry point. Uses `ai-ask-about-profile` Edge Function (Claude Haiku) which loads both profiles, match scores, and conversation history (for chat entry). Conversation lookup uses proper AND filtering to prevent privacy leakage.
    - **AI Neighborhood Intelligence:** `NeighborhoodAISheet` component opens from listing detail ("Ask AI about this neighborhood" button) and listing cards ("Area info" pill). Auto-generates neighborhood briefing on open using `ai-neighborhood-info` Edge Function (Claude Haiku) with Walk Score API (walk/transit/bike scores) and Google Places API (nearby groceries, cafes, gyms, bars, transit, parks). Walk/transit score pills shown with color coding (green/amber/red). Follow-up chat for questions about safety, commute, nightlife, etc. Briefings cached on `listings` table for 7 days (migration 030). User profile context (work style, budget, preferred areas) personalizes responses.
    - **Shareable Profile Notes ("In Their Own Words"):** Free-text field (500 chars) where users describe themselves in their own voice. Added as final step in ProfileQuestionnaireScreen and in EditProfileScreen. Shows on profile detail card as "IN THEIR OWN WORDS" section with coral left-border accent and italic quoted text. Migration `031_profile_notes.sql` adds `profile_note` and `profile_note_updated_at` to `profiles` table. Fed to `ai-ask-about-profile` Edge Function as the most authentic data source about a user. Privacy label ("Visible to your matches") shown everywhere the note appears. This is the only intentional cross-user AI data bridge — everything else (messages, AI memory, chat history) stays scoped to the owner.
- **Existing Roommate Shareable Profile Links:** Hosts with existing roommates can share web links so non-Rhome roommates fill out a lifestyle preferences form (`web/roommate-profile.html`). Preferences are stored in `existing_roommates` table and factored into AI compatibility scoring via `scoreRenterVsExistingRoommate` and `calculateCombinedCompatibility` in `existingRoommateService.ts`. Post-listing creation flow auto-navigates to `InviteExistingRoommatesScreen` when `existing_roommates_count > 0`.
- **Instagram Verification:** OAuth-based Instagram account linking via `instagram-oauth` Edge Function and `instagramService.ts`. Verified badge (`InstagramBadge` component) shown on swipe cards and match celebration. Handle reveal is gated behind Plus/Elite subscription. Edit Profile shows connect/disconnect UI with status. Migration `026_instagram_photos.sql` adds `instagram_verified`, `instagram_handle`, `instagram_user_id` columns plus `live_profiles` view.
- **Multi-Photo Enforcement:** Minimum 3 photos required to save profile (guard in `profileService.ts` and `EditProfileScreen`). Swipe deck filters out profiles with fewer than 3 photos (`discoverService.ts`). Photo counter UI in Edit Profile shows progress toward 3-photo minimum.
- **Chat Leakage Detection & Retention:** `analyze-chat-intent` Edge Function returns `leakageDetected` flag when phone/Instagram sharing is detected. `ChatScreen` shows a retention banner encouraging users to keep chatting on-platform.
- **Safety Mode + Background Check (Persona):** Two-tier background check system (Standard $15, Premium $35) via Persona API with `create-background-check` and `persona-webhook` Edge Functions. `BackgroundCheckScreen` lets renters initiate checks via WebBrowser flow. `BackgroundCheckBadge` shows ID Verified, Background Clear, and Credit Score pills. Safety Mode toggle in Profile Settings blurs phone numbers and social handles in chat messages using `SafeMessageText` component with regex-based detection and tap-to-reveal. Hosts can require background checks on listings via `requires_background_check` toggle. Migration `027_safety_background.sql` adds `background_checks` table, `public_background_badges` view, and `safety_mode_enabled` on profiles.
- **Identity & Verification:** Phone, government ID (Stripe Identity SDK), social media verification, optional background/income checks, and a References System.
- **Boost System:** Tier-based listing and profile boosting for increased visibility.
- **Account Management:** Soft-delete with a 30-day recovery window.
- **Activity-Based Ranking:** Inactive users are ranked lower in the swipe deck.
- **Subscription Management:** Host subscription cancellation and re-activation, universal purchase confirmation modal.
- **UI/UX:** Consistent dark theme with `RhomeLogo` (SVG), collapsible/sticky headers with `react-native-reanimated`.
- **Location System:** Supports multiple US cities with sub-area filtering (e.g., NYC boroughs) via `LocationPicker` and `CityContext`.

## Backend (Supabase)

Supabase provides the entire backend infrastructure:
- **Auth:** Email/password authentication with `AuthContext` and Row Level Security (RLS).
- **Database:** PostgreSQL with RLS. Listings have a computed `rooms_available` column (`bedrooms - host_lives_in - existing_roommates_count`) used across all AI matching. The `existing_roommates` table stores invite tokens and lifestyle preferences for non-Rhome roommates already living in a unit.
- **Realtime:** Subscriptions for messages and notifications.
- **Storage:** For profile and listing photos.
- **Edge Functions:** For webhooks (Stripe), verification sessions, background checks, payments, references, agent placement fees, match score calculation, Claude AI operations (`agent-pair-group`, `company-pair-group`), group-to-listing matching, group unlock payments, and `submit-roommate-profile` (public, no-auth endpoint for existing roommate web form submissions).

## Subscription & Paywall System

Tiered subscription plans for renters (Basic, Plus, Elite), hosts (Free, Starter, Pro, Business), and agents (Pay Per Use, Starter, Pro, Business), plus one-time purchases. **Hybrid payment architecture:** RevenueCat handles Apple IAP + Google Play Billing on native iOS/Android; Stripe handles web payments. `RevenueCatProvider` (contexts/RevenueCatContext.tsx) wraps the app, `lib/revenueCat.ts` provides initialization/purchase/restore helpers. `useStripePayment.native.ts` routes to RevenueCat on native platforms, falls back to Stripe on web. "Restore Purchases" button on all plan screens (required for App Store). RevenueCat webhook edge function (`revenuecat-webhook`) syncs subscription state to Supabase. Plan limits are centralized in `constants/planLimits.ts`.

## Data Layer

Supabase PostgreSQL for primary data storage and local AsyncStorage for caching. TypeScript interfaces define models. A centralized `listingService.ts` handles CRUD operations. The group system supports `roommate` and `listing_inquiry` groups with plan-based limits and administration rules. Host Proactive Group Outreach allows hosts on Starter+ plans to message discoverable renter groups with caps and cooldowns.

## Technical Decisions

Babel module resolver, platform-specific UI adaptations, performance optimizations via React Native's New Architecture, React Compiler, and Reanimated. Robust error handling. Navigation uses separate stack navigators per major tab with `backBehavior="history"`. `messageService.getConversations()` uses single joined queries to prevent N+1 issues. Conditional rendering of HostTabNavigator based on host type.

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
- `@stripe/stripe-react-native` (web fallback)
- `react-native-purchases` (RevenueCat — Apple IAP + Google Play Billing on native)
- `@replit/revenuecat-sdk` (RevenueCat API client for seeding/webhooks)

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