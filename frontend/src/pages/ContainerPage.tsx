import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const ContainerPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Redirect to StoragePage with containers tab active
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'containers');
    navigate(`/storage?${params.toString()}`, { replace: true });
  }, [navigate, searchParams]);

  return null;
};

export default ContainerPage;
