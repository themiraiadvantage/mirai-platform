import { Transform } from "class-transformer";
import { IsEmail, IsString, Length, Matches, MaxLength } from "class-validator";

export class EmailDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
export class LoginDto extends EmailDto {
  @IsString()
  @Length(1, 128)
  password!: string;
}
export class SignupDto extends EmailDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(2, 100)
  name!: string;
  @IsString()
  @Length(8, 128, { message: "Password must be between 8 and 128 characters" })
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9\s])[\s\S]+$/, {
    message:
      "Password must contain an uppercase letter, a lowercase letter, a number, and a special character",
  })
  password!: string;
}
export class VerifyEmailDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  token!: string;
}
export class VerifyCodeDto extends EmailDto {
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: "Enter the 6-digit verification code" })
  code!: string;
}
