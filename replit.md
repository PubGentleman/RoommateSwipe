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
    - **Renter:** Swipe-based matching, 1-on-1 messaging, group management, property exploration with advanced filters, saved properties, AI Match Assistant, property reviews, and chat scheduling. Features an "Renter Intent System" for tailored onboarding. **Host Public Profile:** Tapping any host name (small card or detail card) on ExploreScreen opens `HostPublicProfileScreen` — adaptive layout for individual (simplified: photo, first name, "Host" badge, member since, listings, reviews) vs agent/company (full professional: photo, name, license #, brokerage, agency, phone tap-to-call, units managed, listings, reviews). Explore tab now uses `ExploreStackNavigator` (`ExploreMain` + `HostPublicProfile`). Detail card agent section includes "View Full Profile" link. Reviews section shows first 3 inline with "See All Reviews" opening `HostReviewsScreen` modal.
    - **Host:** Dashboard for listing management (create, edit, delete, boost), inquiry handling, analytics, property review management, host reviews (purple accent `#a78bfa`, separate from property reviews), and group matches monetization. **Multi-Step Listing Wizard:** `CreateEditListingScreen` is an Airbnb-style multi-step wizard (7-9 steps depending on host type). Steps: Property Type → Location → Details → Pricing & Size → [Living Situation (individual only)] → Photos → Amenities & Rules → [Assign Agent (company only)] → Review & Publish. Features: segmented progress bar, step-by-step validation, selection cards, photo grid (2-column), review step with preview card and section-by-section "Edit" links, fixed bottom nav bar (Back/Next), slide animation between steps. Agent/company hosts see professional fields (Unit #, Lease Term, Pet Policy, Parking, MLS# agent-only) and get "Room Configuration" inline on Pricing step instead of Living Situation step. DB migration 079 adds `unit_number`, `lease_term`, `pet_policy`, `parking_type`, `mls_number` to `listings`. Supports Individual, Company, and Agent host types with features like Rhome Select Badge, Company Teams, and Group Bookings. Company and Agent hosts share the same bottom nav layout (Dashboard, Renters, My Groups, Messages, Profile); Team management is accessed from Profile settings for company hosts. Host dashboard shows "My Reviews" card with host avg rating and review count from `host_reviews` table. **Company Team Agent System:** Companies can invite agents (role `'agent'` in `team_members`) with license numbers; agents get linked via `parent_company_id` on `users`; agents can be assigned to listings via `assigned_agent_id`; `getCompanyAgents()` filters `team_members` by `role='agent'` + `status='active'`; `JoinTeamScreen` handles deep link invite acceptance and sets `parent_company_id`/`host_type` on the agent's user record. DB migration 077 adds `agent` role constraint, `agent_license_number`/`agent_specialties` columns on `team_members`, and `parent_company_id` on `users`. **Company Onboarding:** `HostCompanySetupScreen` mirrors agent setup — collects company name, units managed, licensing state, and brokerage license number. Professional hosts (agent/company) skip `ProfileQuestionnaireScreen` during onboarding. Company plans emphasize agent management ("Up to 3/10/unlimited agents under your account").
- **Smart Recommendations Feed:** Personalized recommendation sections at the top of the Explore screen — "Best Match Today" (featured card with gold badge), "New This Week", "Price Drops" (tracked via local price snapshots), "In Your Neighborhoods", and "Quick Move-In". Client-side engine in `utils/recommendationEngine.ts`, UI in `components/RecommendationSection.tsx`. Respects paywall for listing views.
    - **AI-Powered Enhancements:** AI Assistant for personalized housing help, AI-generated match explanations, group and listing suggestions, AI tools for agents/companies, AI-suggested meetups, and AI Neighborhood Intelligence using real-time data and a pre-seeded neighborhood knowledge base.
- **Pi AI Matchmaker:** An AI matchmaker persona (branded "Pi" in all user-facing copy and edge function system prompts) providing insights, deck rankings, host recommendations, and preference parsing, integrated with a subscription-tiered usage system.
- **Pi Demand Intelligence:** Anonymous renter activity tracking feeds market context into Pi's listing advisor mode, aggregating neighborhood and listing demand.
- **Contact Info Protection:** Platform-level contact info blurring in chat messages for free users, with auto-unlocking upon confirmed actions.
- **Agent/Company Messaging Paywall:** Free-tier agents and companies have blurred message previews, with paid plans granting full access.
- **Verification & Safety:** Instagram verification, multi-photo enforcement, chat leakage detection, background checks, identity verification, a References System, Agent License Verification, **Agent/Company Email Domain Blocking** (personal emails blocked at signup with support contact flow; `blocked_email_domains` + `whitelisted_emails` tables, DB trigger on `auth.users`), **Email Verification + Forgot Password** (post-signup verification pending screen with resend/cooldown/polling, dedicated forgot password flow with ForgotPasswordScreen → ResetEmailSentScreen → NewPasswordScreen, PASSWORD_RECOVERY deep link handling), and **Block/Report System** (Apple-compliant user reporting & blocking across all profile views, listing detail, group screens, and member modals; `ReportBlockModal` component with `type` prop for user/listing/group contexts; `moderationService.ts` with `reportUser`, `reportListing`, `reportGroup`, `blockUser`, `getBlockedUserIds`; blocked users filtered from explore feed, roommate swipe, group discover, and open groups).
- **Profile Pause ("I Found a Place"):** Renters can pause their search profiles.
- **Activity Decay Ranking:** Inactive users' profiles progressively sink in discovery surfaces.
- **Boost System:** Three-tier boost system — Quick ($2.99/6h: search ranking only), Standard ($4.99/12h: + Featured badge + impression tracking), Extended ($7.99/24h: + Top Picks placement + full analytics dashboard). No renter-facing view count badge — impressions are host-only analytics. Full boost allocations for all host types: Individual hosts (1-2 free/mo), Agents (2-5 free/mo, pay-per-use agents get pay-per-boost), Companies (3-10 free/mo, Enterprise=unlimited simultaneous). Bulk boost packs available at up to 50% discount. Purchased boost credits never expire; free monthly boosts reset on billing cycle. `BOOST_PACKS` constant in `hostPricing.ts`, `boostCredits` field in `HostSubscriptionData`. Purchase service in `services/boostPurchaseService.ts` handles credit management. Impression tracking service in `services/boostImpressionService.ts` with batched local queue and `getImpressionStats()`. Storage methods: `getBoostCredits()`, `updateBoostCredits()`, `recordBoostPurchase()`, `getBoostPurchaseHistory()`. DB migration 075 adds `boost_credits` JSONB column and `boost_purchases` audit table. DB migration 076 adds `boost_impressions` table for real impression analytics.
- **Account Management:** Soft-delete functionality.
- **Subscription Management:** Tiered subscription plans for renters, hosts, and agents with a hybrid payment architecture.
- **UI/UX:** Consistent dark theme, collapsible/sticky headers, platform-specific interactions, and a comprehensive location system with Area Info Cards.
- **Renter/Host Mode Switch:** Allows individual hosts to toggle between modes.
- **Affiliate Program:** Users can apply to become affiliates with unique referral codes and a dedicated dashboard.
- **Request to Join Group:** Renters can browse and send join requests to open groups.
- **Couple & Room-Matching System:** Groups support couple members sharing one bedroom, with utility functions for managing room needs and group composition. Listings have a computed `rooms_available` column. Group inquiry functionality is dynamically enabled/disabled based on group-listing compatibility (room count + gender preference).
- **Host Gender Preference on Listings:** Individual hosts can set `preferred_tenant_gender` (`any` | `female_only` | `male_only`) on room-type listings only. Enforced via DB constraint (`gender_pref_room_only`). Shown as colored badges on listing cards (pink/blue). Bidirectional feed filtering: host preference filters incompatible renters out, renter's `household_gender_preference` filters incompatible listings. Non-binary/unset gender users only see `any` listings. Company/agent accounts cannot set gender preference. Group inquiries check all members against listing gender preference. Pi AI includes `preferred_tenant_gender` in listing context and nearby listing summaries.
- **Household Gender Preference:** Collected during roommate onboarding (step 5 of 6), saved to both `users` and `profiles` tables. Used for bidirectional swipe feed filtering (hard filter for explicit preferences). Displayed in ProfileCompletionCard. Pi AI reads this field for matching context.
- **Amenity System:** Centralized amenity definitions in `constants/amenities.ts` provide a single source of truth, supporting categorized display, host listing creation, renter preferences, and legacy amenity normalization.
- **Host Badge System:** Three earned achievement badges (Rhome Select, Top Agent, Top Company) signal host quality, with criteria-based progression and daily recalculation via an Edge Function.
- **Apartment Seeker Group System:** Redesigned group experience with an invite system (email/phone, couple option, deep linking), shared liked listings (shortlist with real-time sync and member avatars), and tour scheduling with RSVP functionality.

## Backend

Supabase provides the complete backend infrastructure:
- **Auth:** Email/password authentication with Row Level Security (RLS).
- **Database:** PostgreSQL with RLS, computed columns, and preference tables.
- **Realtime:** Subscriptions for messaging and notifications.
- **Push Notifications:** Expo Notifications for message push alerts. `pushNotificationService.ts` handles token registration/removal. `send-push-notification` Edge Function (triggered by DB webhooks on `messages`/`group_messages` INSERT) sends via Expo Push API. Foreground suppression in ChatScreen dismisses notifications for the active chat. Tapping a notification navigates to the relevant chat via `navigationRef`. Migration 081 creates `push_tokens` table and DB triggers.
- **Storage:** For media assets.
- **Edge Functions:** Used for webhooks, verification, background checks, payments, references, AI operations, match score calculations, group-to-listing matching, and public forms.
- **Neighborhood Knowledge Base:** `neighborhood_data` table with pre-seeded data for 55 NYC/NJ neighborhoods (migrations 070-071). Covers safety scores, transit, amenities, vibe tags, median rents, walkability, and more. Pi AI queries this data in real-time for neighborhood questions. Frontend service (`services/neighborhoodDataService.ts`) provides cached access. NeighborhoodAISheet displays safety/walk/transit/nightlife score pills.

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
- `expo-notifications`
- `expo-device`
- Supabase (Auth, Database, Realtime, Storage, Edge Functions)
- Claude (for AI operations)
- Walk Score API
- Overpass API
- NYC Open Data