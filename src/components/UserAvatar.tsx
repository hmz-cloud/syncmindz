import React, { useState } from 'react';

interface UserAvatarProps {
  name: string;
  avatar?: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showOnlineStatus?: boolean;
  isOnline?: boolean;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  avatar,
  size = 'md',
  className = '',
  showOnlineStatus = false,
  isOnline = true,
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
  };

  const statusDotSize = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
    xl: 'w-3.5 h-3.5',
  };

  const getInitials = (n: string) => {
    const parts = n.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  };

  // Generate deterministic gentle gradient based on name
  const getGradient = (str: string) => {
    const gradients = [
      'from-indigo-500 to-violet-600',
      'from-rose-500 to-pink-600',
      'from-emerald-500 to-teal-600',
      'from-amber-500 to-orange-600',
      'from-sky-500 to-blue-600',
      'from-purple-500 to-indigo-600',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
  };

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {avatar && !imageError ? (
        <img
          src={avatar}
          alt={name}
          onError={() => setImageError(true)}
          referrerPolicy="no-referrer"
          className={`${sizeClasses[size]} rounded-full object-cover ring-2 ring-white shadow-xs`}
        />
      ) : (
        <div
          className={`${sizeClasses[size]} rounded-full bg-gradient-to-tr ${getGradient(
            name
          )} flex items-center justify-center font-bold text-white shadow-xs select-none`}
        >
          {getInitials(name)}
        </div>
      )}

      {showOnlineStatus && (
        <span
          className={`absolute bottom-0 right-0 ${statusDotSize[size]} rounded-full ${
            isOnline ? 'bg-emerald-500' : 'bg-slate-400'
          } ring-2 ring-white`}
        />
      )}
    </div>
  );
};
