1. **Understand the Goal**: The memory `.jules/sentinel.md` specifically states: "Prevent Information Disclosure in API Responses... Raw error messages (`error.message`) were being directly exposed to clients in API error responses (e.g., in `src/controllers/user.controller.js`). Always log the full error details server-side using the internal logger (`log.error`) and return generic, safe error messages to the client (e.g., "Unable to load profile")."
2. **Identify the Issue**: In `src/controllers/user.controller.js`, there's a vulnerability at line 487 where `return res.status(statusCode).json({ success: false, message: error.message });` directly returns the raw `error.message` to the client. We need to prevent this information disclosure. The memory suggests using a generic error message. Since this happens for `USER_NOT_FOUND` and `USER_ALREADY_ONBOARDED`, returning those explicit string constants as messages is probably what was happening before, but if `statusCode !== 400`, the `error.message` could theoretically leak something. Actually, if `error.message` is exactly `USER_NOT_FOUND` or `USER_ALREADY_ONBOARDED`, it might be fine, but to be strictly safe and follow the instructions ("return generic, safe error messages to the client (e.g., 'Unable to load profile')"), we can rewrite it. Let's look closer. Wait, if it's 404, the message should probably just be 'User not found'. If it's 409, 'User already onboarded'. If it's 400, it's already 'Unable to complete profile'. Let's ensure NO OTHER error messages can leak.
3. **Analyze Current Code**:
```javascript
  } catch (error) {
    const statusCode = error.message === 'USER_NOT_FOUND'
      ? 404
      : (error.message === 'USER_ALREADY_ONBOARDED' ? 409 : 400);
    if (statusCode === 400) {
      log.error('Error completing profile:', error);
      return res.status(statusCode).json({ success: false, message: 'Unable to complete profile' });
    }
    return res.status(statusCode).json({ success: false, message: error.message });
  } finally {
```
The issue is `message: error.message` on line 487. While it currently only executes if `statusCode` is 404 or 409 (where `error.message` would be exactly `USER_NOT_FOUND` or `USER_ALREADY_ONBOARDED`), it's still sending `error.message` explicitly, which is an anti-pattern. We can change it to send a hardcoded string based on the status code.

Let's modify the catch block to:
```javascript
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (error.message === 'USER_ALREADY_ONBOARDED') {
      return res.status(409).json({ success: false, message: 'User already onboarded' });
    }
    log.error('Error completing profile:', error);
    return res.status(400).json({ success: false, message: 'Unable to complete profile' });
  } finally {
```
This safely abstracts the error without sending `error.message` and handles the generic fallback properly!

4. **Identify other potential Information Disclosures**: Let's grep for `error.message` across other controllers. The prompt asks me to fix ONE small security issue. I'll fix this specific one since it's mentioned in the `.jules/sentinel.md` as the most recent vulnerability!

Wait, let's also check line 203:
```javascript
    if (error instanceof PlanLimitExceededError || error instanceof PlanAdminLimitExceededError) {
      return res.status(403).json({
        success: false,
        error: error.code,
        message: error.message,
        ...responseMeta,
      });
    }
```
If `PlanLimitExceededError` or `PlanAdminLimitExceededError` contains sensitive info, that could be a leak. But typically domain errors are safe. The memory specifically called out `error.message` being directly exposed to clients in API error responses (e.g., in `src/controllers/user.controller.js`).

Let's check `src/controllers/user.controller.js` line 480 again. Yes, that is the exact issue. I will fix the catch block.

Let me also check `.jules/sentinel.md` entry:
```
## 2026-05-21 - Prevent Information Disclosure in API Responses
**Vulnerability:** Raw error messages (`error.message`) were being directly exposed to clients in API error responses (e.g., in `src/controllers/user.controller.js`).
**Learning:** Exposing raw internal error details to the client can leak sensitive system information, configuration details, or underlying infrastructure state, which can be leveraged by attackers.
**Prevention:** Always log the full error details server-side using the internal logger (`log.error`) and return generic, safe error messages to the client (e.g., "Unable to load profile").
```

Let's do this!

5. **Plan Execution**:
   - `request_plan_review`: Send the plan.
   - `set_plan`: Set the plan.
   - `replace_with_git_merge_diff`: Apply the fix to `src/controllers/user.controller.js`.
   - `run_in_bash_session`: Run `pnpm test` and `pnpm lint`.
   - `submit`: Submit the changes.
