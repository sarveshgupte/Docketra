export NODE_ENV=test
export JWT_SECRET=0123456789abcdef0123456789abcdef
export SUPERADMIN_PASSWORD_HASH='$2b$10$abcdefghijklmnopqrstuu0Lz3M0RtZpmjHtkobaN6D2PfYZ7RUTy'
export SUPERADMIN_XID=X000001
export SUPERADMIN_EMAIL=superadmin@example.com
export SUPERADMIN_OBJECT_ID=000000000000000000000001
export MONGO_URI=mongodb://127.0.0.1:27017/docketra
export DISABLE_GOOGLE_AUTH=true
export ENCRYPTION_PROVIDER=disabled

npm run test
