import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from "class-validator";
import { Transform } from "class-transformer";
import { StaffRole } from "../generated/prisma/enums";
import { EmailDto, VerifyEmailDto } from "./dto";
import { STAFF_SECTIONS } from "./staff-permissions";

export class StaffPermissionsDto {
  @IsEnum(StaffRole) role!: StaffRole;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(STAFF_SECTIONS.length)
  @ArrayUnique()
  @IsIn(STAFF_SECTIONS, { each: true })
  permissions?: string[];
}

export class InviteStaffDto extends EmailDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(2, 100)
  name!: string;
  @IsEnum(StaffRole) role: StaffRole = StaffRole.ADMIN;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(STAFF_SECTIONS.length)
  @ArrayUnique()
  @IsIn(STAFF_SECTIONS, { each: true })
  permissions?: string[];
}
export class AcceptStaffDto extends VerifyEmailDto {
  @IsString()
  @Length(8, 128)
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9\s])[\s\S]+$/, {
    message: "Use uppercase and lowercase letters, a number and a special character.",
  })
  password!: string;
}
export class StaffAccessDto {
  @IsBoolean() active!: boolean;
}
