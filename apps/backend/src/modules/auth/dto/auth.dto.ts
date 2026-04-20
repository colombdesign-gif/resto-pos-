import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
  IsIn,
} from 'class-validator';

export class RegisterDto {
  @IsNotEmpty({ message: 'İşletme adı zorunludur' })
  @IsString()
  businessName: string;

  @IsNotEmpty({ message: 'Ad soyad zorunludur' })
  @IsString()
  name: string;

  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Şifre en az 6 karakter olmalıdır' })
  password: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin' })
  email: string;

  @IsNotEmpty({ message: 'Şifre zorunludur' })
  @IsString()
  password: string;
}

export class RefreshTokenDto {
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}

export class ChangePasswordDto {
  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}
