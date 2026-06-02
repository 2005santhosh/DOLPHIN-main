# Requirements Document

## Introduction

Verified profiles on the platform should receive boosted visibility in listing pages. A user is considered verified when `isVerified=true`, `verifiedSource='payment'`, and `verifiedUntil` is a date in the future (payment-only verification). Verified founders should appear first when investors and providers browse startup/founder listings. Verified investors and providers should appear first when founders browse investor and provider listings. The sort is performed server-side to ensure consistent, performant ordering across all clients. Within each group (verified and non-verified), the existing relative order is preserved.

## Glossary

- **Verified_User**: A platform user where `isVerified=true` AND `verifiedSource='payment'` AND `verifiedUntil > now()`. Users verified via other sources (`'founder'`, `'admin'`) are NOT considered verified for visibility-boosting purposes.
- **Verified_Founder**: A Verified_User with `role='founder'`.
- **Verified_Investor**: A Verified_User with `role='investor'`.
- **Verified_Provider**: A Verified_User with `role='provider'`.
- **Visibility_Sort**: The server-side sort that places Verified_Users before non-verified users in a listing response. Within each group, the pre-existing relative order (by score or date) is maintained.
- **Featured_Badge**: A visual UI indicator displayed on a profile card to signal the profile is verified and has boosted placement.
- **StartupsPage**: The React page shown to investors listing validated startups (`GET /api/investor/validated-startups`).
- **InvestorsProvidersPage**: The React page shown to founders listing investors (`GET /api/founder/investors`) and providers (`GET /api/founder/providers`).
- **FoundersPage**: The React page shown to providers listing eligible founders (`GET /api/provider/eligible-founders`).
- **Listing_API**: Any of the four backend endpoints that return profile lists subject to Visibility_Sort: `GET /api/investor/validated-startups`, `GET /api/founder/investors`, `GET /api/founder/providers`, `GET /api/provider/eligible-founders`.

---

## Requirements

### Requirement 1: Verified Founder Visibility for Investors

**User Story:** As an investor, I want verified founders to appear at the top of the startups listing, so that I can quickly discover high-credibility startup profiles.

#### Acceptance Criteria

1. WHEN the Listing_API `GET /api/investor/validated-startups` returns results, THE Listing_API SHALL place all startups whose `founderId` is a Verified_Founder before all startups whose `founderId` is not a Verified_Founder.
2. WHILE the results contain multiple verified founders, THE Listing_API SHALL preserve the existing relative order among those verified-founder startups (by `validationScore` descending, then `createdAt` descending as tiebreaker).
3. WHILE the results contain multiple non-verified founders, THE Listing_API SHALL preserve the existing relative order among those non-verified-founder startups.
4. WHEN determining verification status, THE Listing_API SHALL evaluate `isVerified=true` AND `verifiedSource='payment'` AND `verifiedUntil > now()` on the founder's User record.
5. IF a founder's `verifiedUntil` date is in the past, THEN THE Listing_API SHALL treat that founder as non-verified for ordering purposes.

---

### Requirement 2: Verified Investor Visibility for Founders

**User Story:** As a founder, I want verified investors to appear at the top of the investors listing, so that I can quickly identify and connect with credible investors.

#### Acceptance Criteria

1. WHEN the Listing_API `GET /api/founder/investors` returns results, THE Listing_API SHALL place all Verified_Investors before all non-verified investors.
2. WHILE the results contain multiple verified investors, THE Listing_API SHALL preserve the existing relative order among those verified investors.
3. WHILE the results contain multiple non-verified investors, THE Listing_API SHALL preserve the existing relative order among those non-verified investors.
4. WHEN determining verification status, THE Listing_API SHALL evaluate `isVerified=true` AND `verifiedSource='payment'` AND `verifiedUntil > now()` on the investor's User record.
5. IF an investor's `verifiedUntil` date is in the past or exactly equal to the current timestamp, THEN THE Listing_API SHALL treat that investor as non-verified for ordering purposes.
6. IF the verification status evaluation fails due to a database error or system issue, THEN THE Listing_API SHALL treat the affected investor as non-verified and continue returning results.

---

### Requirement 3: Verified Provider Visibility for Founders

**User Story:** As a founder, I want verified providers to appear at the top of the providers listing, so that I can quickly find reliable service providers.

#### Acceptance Criteria

1. WHEN the Listing_API `GET /api/founder/providers` returns results, THE Listing_API SHALL place all Verified_Providers before all non-verified providers.
2. WHILE the results contain multiple verified providers, THE Listing_API SHALL preserve the existing relative order among those verified providers.
3. WHILE the results contain multiple non-verified providers, THE Listing_API SHALL preserve the existing relative order among those non-verified providers.
4. WHEN determining verification status, THE Listing_API SHALL evaluate `isVerified=true` AND `verifiedSource='payment'` AND `verifiedUntil > now()` on the provider's User record (via the `Provider.userId` reference).
5. IF a provider's `verifiedUntil` date is in the past or exactly equal to the current timestamp, THEN THE Listing_API SHALL treat that provider as non-verified for ordering purposes.
6. IF the verification status evaluation fails due to a database error or system issue, THEN THE Listing_API SHALL treat the affected provider as non-verified and continue returning results.

---

### Requirement 4: Verified Founder Visibility for Providers

**User Story:** As a provider, I want verified founders to appear at the top of the founders listing, so that I can prioritise outreach to high-credibility startup profiles.

#### Acceptance Criteria

1. WHEN the Listing_API `GET /api/provider/eligible-founders` returns results, THE Listing_API SHALL place all startups whose `founderId` is a Verified_Founder before all startups whose `founderId` is not a Verified_Founder.
2. WHILE the results contain multiple verified founders, THE Listing_API SHALL preserve the existing relative order among those verified-founder startups.
3. WHILE the results contain multiple non-verified founders, THE Listing_API SHALL preserve the existing relative order among those non-verified founders.
4. WHEN determining verification status, THE Listing_API SHALL evaluate `isVerified=true` AND `verifiedSource='payment'` AND `verifiedUntil > now()` on the founder's User record.
5. IF a founder's `verifiedUntil` date is exactly equal to the current timestamp, THE Listing_API SHALL treat that founder as verified (verification expires after the specified moment, not at it).
6. IF a founder's `verifiedUntil` date is strictly in the past, THEN THE Listing_API SHALL treat that founder as non-verified for ordering purposes.

---

### Requirement 5: Server-Side Sort Determinism and Idempotency

**User Story:** As a platform operator, I want the boosted ordering to be consistent and reproducible, so that verified profiles always appear first regardless of how many times the endpoint is called or in what order data is inserted.

#### Acceptance Criteria

1. THE Listing_API SHALL apply the Visibility_Sort entirely within the backend before sending the HTTP response, without relying on any client-side reordering.
2. WHEN the Listing_API is called multiple times with the same underlying data, THE Listing_API SHALL return results in the same order on every call (determinism).
3. WHEN the Visibility_Sort is applied to an already-sorted list, THE Listing_API SHALL produce an identical list (idempotency: applying the sort twice yields the same result as applying it once).
4. THE Listing_API SHALL use a stable sort algorithm so that profiles with equal verification status maintain their original relative order.

---

### Requirement 6: Featured Badge Visual Indicator

**User Story:** As a user browsing listings, I want verified profiles to display a visible "Featured" indicator, so that I understand why a profile appears at the top of the list.

#### Acceptance Criteria

1. WHEN a startup card is rendered in StartupsPage and the startup's founder is a Verified_Founder, THE StartupsPage SHALL display a Featured_Badge on that startup's card.
2. WHEN a profile card is rendered in InvestorsProvidersPage and the profile belongs to a Verified_Investor or Verified_Provider, THE InvestorsProvidersPage SHALL display a Featured_Badge on that profile's card.
3. WHEN a founder card is rendered in FoundersPage and the startup's founder is a Verified_Founder, THE FoundersPage SHALL display a Featured_Badge on that founder's card.
4. WHEN a profile is not a Verified_User, THE listing page SHALL NOT display a Featured_Badge on that profile's card.
5. THE Featured_Badge SHALL be visually distinct and positioned consistently on each card (e.g., a small labelled chip or ribbon, not solely a checkmark icon, so the reason for top placement is clear to the viewer).
6. WHILE verification status data has not yet loaded in the UI, THE listing page SHALL allow a profile card to temporarily display a Featured_Badge if the local user data indicates verification, and SHALL remove the badge once the loaded data confirms the profile is not verified.

---

### Requirement 7: Verification Fields Exposed in API Responses

**User Story:** As a frontend developer, I want verification fields to be included in listing API responses, so that the UI can correctly render Featured_Badges without additional round trips.

#### Acceptance Criteria

1. WHEN `GET /api/investor/validated-startups` returns a startup, THE Listing_API SHALL include `isVerified`, `verifiedSource`, and `verifiedUntil` fields from the founder's User record in the `founderId` object of each startup item.
2. WHEN `GET /api/founder/investors` returns an investor, THE Listing_API SHALL include `isVerified`, `verifiedSource`, and `verifiedUntil` fields on each investor object.
3. WHEN `GET /api/founder/providers` returns a provider, THE Listing_API SHALL include `isVerified`, `verifiedSource`, and `verifiedUntil` fields from the provider's User record on each provider object.
4. WHEN `GET /api/provider/eligible-founders` returns a founder startup, THE Listing_API SHALL include `isVerified`, `verifiedSource`, and `verifiedUntil` fields from the founder's User record in the `founderId` object of each startup item.
5. IF the verification data (any of `isVerified`, `verifiedSource`, or `verifiedUntil`) is missing for a user due to a database error, THEN THE Listing_API SHALL return an HTTP 500 error response rather than returning partial data.
