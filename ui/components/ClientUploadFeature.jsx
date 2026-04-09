import '../styles/clientUploadFeature.css';

export function ClientUploadFeature() {
  return (
    <section className="client-upload-feature">
      <div className="client-upload-container">
        <div className="client-upload-text">
          <h2>Collect documents from clients — instantly</h2>

          <p>
            Send a secure link. No login. No email attachments.
            Clients upload files directly into your docket.
          </p>

          <div className="client-upload-steps">
            <div>1. Generate link</div>
            <div>2. Share with client</div>
            <div>3. Receive documents instantly</div>
          </div>

          <p className="client-upload-trust">
            No login required • Secure upload • Works on any device
          </p>
        </div>

        <div className="client-upload-visual">
          <div className="client-upload-flow">
            <span>Send Link</span>
            <span>→</span>
            <span>Client Uploads</span>
            <span>→</span>
            <span>Files in Docket</span>
          </div>
        </div>
      </div>
    </section>
  );
}
