'use client';

import { signOut } from 'next-auth/react';
import Image from 'next/image';

interface UserMenuProps {
  userName?: string | null;
  userImage?: string | null;
}

export function UserMenu({ userName, userImage }: UserMenuProps) {
  return (
    <button
      onClick={() => signOut()}
      className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
      title={userName ? `${userName} - 点击退出` : '退出登录'}
    >
      {userImage ? (
        <Image
          src={userImage}
          alt=""
          width={28}
          height={28}
          className="rounded-full"
        />
      ) : (
        <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs">
          {userName?.[0] ?? '?'}
        </div>
      )}
    </button>
  );
}
