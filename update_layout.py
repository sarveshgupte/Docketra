import re

with open('ui/src/components/common/Layout.jsx', 'r') as f:
    content = f.read()

# Add useId to React imports
if 'useId' not in content:
    content = content.replace("import React, { useState, useEffect, useRef, useCallback } from 'react';", "import React, { useState, useEffect, useRef, useCallback, useId } from 'react';")

# Add useId variables
if 'const notificationDropdownId = useId();' not in content:
    content = content.replace('  const { firmSlug } = useParams();', '  const { firmSlug } = useParams();\n  const notificationDropdownId = useId();\n  const profileDropdownId = useId();')

# Replace notification aria-controls
content = content.replace('aria-controls="notification-dropdown-menu"', 'aria-controls={notificationDropdownId}')
content = content.replace('id="notification-dropdown-menu"', 'id={notificationDropdownId}')

# Replace profile aria-controls
content = content.replace('aria-controls="profile-dropdown-menu"', 'aria-controls={profileDropdownId}')
content = content.replace('id="profile-dropdown-menu"', 'id={profileDropdownId}')

with open('ui/src/components/common/Layout.jsx', 'w') as f:
    f.write(content)
