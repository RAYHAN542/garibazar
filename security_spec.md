# security_spec.md

## 1. Data Invariants
1. **User Identity Invariant**: A user document under `users/{uid}` can only be created or modified if the document ID matches the authenticated user's UID (`request.auth.uid`). No user can write to another user's profile.
2. **Seller/Owner Invariant**: A listing under `listings/{listingId}` can only be created if its `sellerId` field strictly matches `request.auth.uid`. Updates and deletions are restricted to the owner (`sellerId == request.auth.uid`) or an authorized administrator.
3. **No Self-Assigned Privileges (Admin Invariant)**: Documents in the `admins/{uid}` collection cannot be modified by clients. The write permissions are set to "deny all" for client SDKs.
4. **Rate Limit Invariant**: Documents under `rate_limits/{key}` are purely system-internal and cannot be read or written by client SDKs.
5. **Voucher & Refill Request Integrity**: A refill/payment request under `refill_requests/{requestId}` or `payments/{paymentId}` can only be created by an authenticated user where the `userId` in the payload matches `request.auth.uid`. The `status` field on creation must be `"pending"` to prevent unauthorized self-approval of credits. Only administrators can update or delete these documents.
6. **Purchase History Integrity**: A purchase record under `purchases/{purchaseId}` can only be created if the `buyerId` matches `request.auth.uid`. Updates/deletions are restricted to administrators.
7. **Review Authenticity**: A seller review under `seller_reviews/{reviewId}` can only be created if the `reviewerId` matches `request.auth.uid`. Users cannot spoof reviews under someone else's name or UID.

---

## 2. The "Dirty Dozen" Payloads
Here are 12 specific JSON payloads designed to exploit potential vulnerabilities, all of which must return `PERMISSION_DENIED` under the hardened rules.

### Payload 1: Spoofed Seller ID on Listing Creation
*   **Target Collection**: `listings`
*   **Action**: Create
*   **Auth User**: UID `buyer_123`
*   **Payload**:
    ```json
    {
      "title": "Excavator CAT 320D",
      "category": "vehicles",
      "model": "320D",
      "price": 4500000,
      "description": "Original CAT crawler excavator",
      "contactNumber": "01711112222",
      "sellerName": "Attacker",
      "location": "Dhaka (ঢাকা)",
      "image": "https://example.com/image.jpg",
      "createdAt": "2026-06-24T10:00:00Z",
      "sellerId": "victim_seller_uid_456",
      "isSold": false
    }
    ```
*   **Vulnerability Exploited**: Identity Spoofing / Impersonating a seller.

### Payload 2: Stranger Modifying Listing Price/Details
*   **Target Collection**: `listings/{listingId}` (where owner is `seller_789`)
*   **Action**: Update
*   **Auth User**: UID `malicious_user_007`
*   **Payload**:
    ```json
    {
      "price": 100
    }
    ```
*   **Vulnerability Exploited**: Write Privilege Escalation / Unauthorised modifications.

### Payload 3: User Profile Poisoning (Modifying Victim Profile)
*   **Target Collection**: `users/victim_uid_456`
*   **Action**: Create/Update
*   **Auth User**: UID `malicious_user_007`
*   **Payload**:
    ```json
    {
      "displayName": "Hacked Profile Name",
      "simulatedCredits": 999999
    }
    ```
*   **Vulnerability Exploited**: Identity Theft / Profile tampering.

### Payload 4: Self-Escalation to Administrator
*   **Target Collection**: `admins/malicious_user_007`
*   **Action**: Create/Set
*   **Auth User**: UID `malicious_user_007`
*   **Payload**:
    ```json
    {
      "role": "admin",
      "grantedAt": "2026-06-24T10:00:00Z"
    }
    ```
*   **Vulnerability Exploited**: Client-side Privilege Escalation.

### Payload 5: Rate Limit Tampering / Counter Reset
*   **Target Collection**: `rate_limits/malicious_user_007_limit`
*   **Action**: Create/Set/Update
*   **Auth User**: UID `malicious_user_007`
*   **Payload**:
    ```json
    {
      "count": 0,
      "timestamp": "2026-06-24T10:00:00Z"
    }
    ```
*   **Vulnerability Exploited**: Denial of Service / Security bypass.

### Payload 6: Self-Approving Refill Request (Direct Financial Theft)
*   **Target Collection**: `refill_requests/request_999`
*   **Action**: Create
*   **Auth User**: UID `malicious_user_007`
*   **Payload**:
    ```json
    {
      "userId": "malicious_user_007",
      "userName": "Hacker",
      "amount": 5000,
      "method": "bKash",
      "status": "approved",
      "createdAt": "2026-06-24T10:00:00Z"
    }
    ```
*   **Vulnerability Exploited**: Financial Integrity Bypass (self-credited wallet).

### Payload 7: Hijacking Purchase Orders (Victim Buys for Attacker)
*   **Target Collection**: `purchases`
*   **Action**: Create
*   **Auth User**: UID `malicious_user_007`
*   **Payload**:
    ```json
    {
      "title": "CAT Engine Part X",
      "price": 12000,
      "buyerId": "victim_uid_456",
      "status": "pending",
      "createdAt": "2026-06-24T10:00:00Z"
    }
    ```
*   **Vulnerability Exploited**: Hijacked Purchase Tracking.

### Payload 8: Spofing Review Authorship (Reviewing Under Someone Else's UID)
*   **Target Collection**: `seller_reviews`
*   **Action**: Create
*   **Auth User**: UID `malicious_user_007`
*   **Payload**:
    ```json
    {
      "sellerId": "seller_789",
      "reviewerId": "innocent_user_111",
      "reviewerName": "Innocent Bystander",
      "rating": 1,
      "comment": "Worst seller ever!",
      "createdAt": "2026-06-24T10:00:00Z"
    }
    ```
*   **Vulnerability Exploited**: Review Manipulation / Character Defamation.

### Payload 9: Unauthorized Deletion of Victim's Listing
*   **Target Collection**: `listings/victim_listing_id_999` (where owner is `seller_789`)
*   **Action**: Delete
*   **Auth User**: UID `malicious_user_007`
*   **Vulnerability Exploited**: Denial of Service / Griefing.

### Payload 10: Tampering with Immutable Field `createdAt` in Listing Update
*   **Target Collection**: `listings/seller_listing_id_777`
*   **Action**: Update
*   **Auth User**: UID `seller_777` (the correct owner)
*   **Payload**:
    ```json
    {
      "createdAt": "2020-01-01T00:00:00Z"
    }
    ```
*   **Vulnerability Exploited**: Integrity Modification of History Logs.

### Payload 11: Modifying Status of Refill Request to "approved" (Stranger or Owner)
*   **Target Collection**: `refill_requests/request_123` (status is currently "pending")
*   **Action**: Update
*   **Auth User**: UID `malicious_user_007` (or even the request initiator)
*   **Payload**:
    ```json
    {
      "status": "approved"
    }
    ```
*   **Vulnerability Exploited**: State-machine shortcut / Privilege Escalation.

### Payload 12: Changing Status of Purchase History Doc
*   **Target Collection**: `purchases/purchase_888`
*   **Action**: Update
*   **Auth User**: UID `malicious_user_007` (or the buyer themselves)
*   **Payload**:
    ```json
    {
      "status": "completed"
    }
    ```
*   **Vulnerability Exploited**: Unauthorized Order State Mutation.

---

## 3. The Test Runner Specification
Below is an automated test suite skeleton (`firestore.rules.test.ts`) that describes how to verify that all of the above payloads return `PERMISSION_DENIED` and that normal users can still proceed with valid operations.

```typescript
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { setDoc, getDoc, updateDoc, deleteDoc, doc, collection } from "firebase/firestore";
import * as fs from "fs";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "gari-bazar-test-project",
    firestore: {
      rules: fs.readFileSync("firestore.rules", "utf8"),
      host: "localhost",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("Gari Bazar Firestore Security Rules Test Suite", () => {
  test("P1: Block spoofed seller ID on listing creation", async () => {
    const maliciousContext = testEnv.authenticatedContext("buyer_123");
    const db = maliciousContext.firestore();
    const docRef = doc(collection(db, "listings"));
    await expect(
      setDoc(docRef, {
        title: "Excavator CAT 320D",
        category: "vehicles",
        model: "320D",
        price: 4500000,
        description: "Original CAT crawler excavator",
        contactNumber: "01711112222",
        sellerName: "Attacker",
        location: "Dhaka (ঢাকা)",
        image: "https://example.com/image.jpg",
        createdAt: "2026-06-24T10:00:00Z",
        sellerId: "victim_seller_uid_456",
        isSold: false
      })
    ).rejects.toThrow("PERMISSION_DENIED");
  });

  test("P2: Stranger cannot modify listing details", async () => {
    // Setup initial clean listing
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, "listings/test_listing"), {
        title: "Original",
        sellerId: "seller_789"
      });
    });

    const maliciousContext = testEnv.authenticatedContext("malicious_user_007");
    const db = maliciousContext.firestore();
    await expect(
      updateDoc(doc(db, "listings/test_listing"), { price: 100 })
    ).rejects.toThrow("PERMISSION_DENIED");
  });

  test("P3: User cannot update another user's profile", async () => {
    const maliciousContext = testEnv.authenticatedContext("malicious_user_007");
    const db = maliciousContext.firestore();
    await expect(
      setDoc(doc(db, "users/victim_uid_456"), {
        displayName: "Hacked Profile Name"
      })
    ).rejects.toThrow("PERMISSION_DENIED");
  });

  test("P4: Block self-escalation to admin role", async () => {
    const maliciousContext = testEnv.authenticatedContext("malicious_user_007");
    const db = maliciousContext.firestore();
    await expect(
      setDoc(doc(db, "admins/malicious_user_007"), { role: "admin" })
    ).rejects.toThrow("PERMISSION_DENIED");
  });

  test("P5: Block client-side modification of rate limits", async () => {
    const maliciousContext = testEnv.authenticatedContext("malicious_user_007");
    const db = maliciousContext.firestore();
    await expect(
      setDoc(doc(db, "rate_limits/malicious_user_007_limit"), { count: 0 })
    ).rejects.toThrow("PERMISSION_DENIED");
  });

  test("P6: Block self-approving refill request creation", async () => {
    const maliciousContext = testEnv.authenticatedContext("malicious_user_007");
    const db = maliciousContext.firestore();
    await expect(
      setDoc(doc(db, "refill_requests/request_999"), {
        userId: "malicious_user_007",
        amount: 5000,
        method: "bKash",
        status: "approved",
        createdAt: "2026-06-24T10:00:00Z"
      })
    ).rejects.toThrow("PERMISSION_DENIED");
  });

  test("P7: Block hijacked purchase order creation", async () => {
    const maliciousContext = testEnv.authenticatedContext("malicious_user_007");
    const db = maliciousContext.firestore();
    await expect(
      setDoc(doc(db, "purchases/p_1"), {
        title: "CAT Engine",
        price: 12000,
        buyerId: "victim_uid_456",
        status: "pending",
        createdAt: "2026-06-24T10:00:00Z"
      })
    ).rejects.toThrow("PERMISSION_DENIED");
  });

  test("P8: Block spoofing review author UID", async () => {
    const maliciousContext = testEnv.authenticatedContext("malicious_user_007");
    const db = maliciousContext.firestore();
    await expect(
      setDoc(doc(db, "seller_reviews/r_1"), {
        sellerId: "seller_789",
        reviewerId: "innocent_user_111",
        reviewerName: "Innocent Bystander",
        rating: 1,
        comment: "Worst!",
        createdAt: "2026-06-24T10:00:00Z"
      })
    ).rejects.toThrow("PERMISSION_DENIED");
  });

  test("P9: Block unauthorized listing deletion", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, "listings/victim_listing_id_999"), {
        sellerId: "seller_789"
      });
    });

    const maliciousContext = testEnv.authenticatedContext("malicious_user_007");
    const db = maliciousContext.firestore();
    await expect(
      deleteDoc(doc(db, "listings/victim_listing_id_999"))
    ).rejects.toThrow("PERMISSION_DENIED");
  });

  test("P10: Immutable field createdAt cannot be updated", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, "listings/seller_listing_id_777"), {
        title: "Original Title",
        sellerId: "seller_777",
        createdAt: "2026-06-24T10:00:00Z"
      });
    });

    const ownerContext = testEnv.authenticatedContext("seller_777");
    const db = ownerContext.firestore();
    await expect(
      updateDoc(doc(db, "listings/seller_listing_id_777"), {
        createdAt: "2020-01-01T00:00:00Z"
      })
    ).rejects.toThrow("PERMISSION_DENIED");
  });

  test("P11: User cannot approve/update refill requests", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, "refill_requests/request_123"), {
        userId: "malicious_user_007",
        status: "pending"
      });
    });

    const ownerContext = testEnv.authenticatedContext("malicious_user_007");
    const db = ownerContext.firestore();
    await expect(
      updateDoc(doc(db, "refill_requests/request_123"), {
        status: "approved"
      })
    ).rejects.toThrow("PERMISSION_DENIED");
  });

  test("P12: User cannot update purchase history document", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, "purchases/purchase_888"), {
        buyerId: "buyer_123",
        status: "pending"
      });
    });

    const ownerContext = testEnv.authenticatedContext("buyer_123");
    const db = ownerContext.firestore();
    await expect(
      updateDoc(doc(db, "purchases/purchase_888"), {
        status: "completed"
      })
    ).rejects.toThrow("PERMISSION_DENIED");
  });
});
```
