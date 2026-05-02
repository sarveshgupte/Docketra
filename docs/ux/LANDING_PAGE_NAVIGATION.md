# Landing Page Navigation UX

## Philosophy
Docketra's landing page is designed as a single conversion journey:

1. Understand **why** Docketra exists
2. Understand the **product** directly on the same page
3. See it **in practice**
4. Build **trust**
5. Choose a primary action: **Request early access** or **Login**

This keeps first-time visitor choices focused and avoids marketing-page sprawl.

## Top navigation behavior
The top navigation includes only:

- Why
- Product
- In practice
- Trust
- Login
- Request early access

Rules:

- **Why / Product / In practice / Trust are in-page section navigation only**.
- These items use hash/scroll behavior and do not represent standalone product-marketing pages.
- Login and Request early access remain global CTA actions.

## Footer behavior
The landing footer is intentionally compact and secondary.

### Removed from landing footer
- Features
- About
- Contact

### Kept in landing footer
- Terms (`/terms`)
- Privacy (`/privacy`)
- Security (`/security`)
- Acceptable Use (`/acceptable-use`)
- hello@docketra.com

### Brand text
- Docketra
- Run your firm with memory.
- Built for professional firms in India

## Routing policy
- Legal routes remain routable and available.
- Product explanation lives on the landing page; product-marketing routes are not promoted from landing navigation/footer.
- Unknown or stale landing hashes are handled safely (ignored by falling back to top-of-page scroll) so users don't hit broken UX states.
