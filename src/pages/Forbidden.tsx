import { Link } from 'react-router-dom';

export function Forbidden() {
  return (
    <div className="forbidden" data-testid="forbidden-page">
      <h1>403</h1>
      <p>You don't have permission to view this page.</p>
      <Link to="/" className="btn btn-primary">
        Back to dashboard
      </Link>
    </div>
  );
}
