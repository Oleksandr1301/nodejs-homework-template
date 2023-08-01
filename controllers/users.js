const bcrypt = require("bcrypt");
const { userValidator } = require("../validator/validator");
const service = require("../services/user");
const jwt = require("jsonwebtoken");
const User = require("../services/schemas/users");
const { HttpError } = require("../helpers/index");
require("dotenv").config();
const gravatar = require("gravatar");
const fs = require("fs/promises");
const path = require("path");
const Jimp = require("jimp");
const { nanoid } = require("nanoid/non-secure");
const { sendEmail } = require("../helpers/mail");
const secret = process.env.SECRET;

const avatarDir = path.resolve("public", "avatars");

const register = async (req, res, next) => {
  try {
    const { error } = userValidator(req.body);
    if (error) {
      throw HttpError(409, "Email in use");
    }
    const { email, password, subscription } = req.body;
    const user = await User.findOne({ email });

    if (user) {
      return res.status(409).json({
        status: "error",
        code: 409,
        message: "Email is already in use",
        data: "Conflict",
      });
    }
    const avatarURL = gravatar.url(email, {
      s: "200",
      r: "pg",
      d: "mm",
    });
    const createHashPassword = await bcrypt.hash(password, 10);
    const verificationToken = nanoid();
    const newUser = await User.create({
      ...req.body,
      password: createHashPassword,
      subscription,
      avatarURL,
      verificationToken,
    });

   
    await sendEmail({
      to: newUser.email,
      subject: `Welcome on board, ${newUser.email}`,
      html: `To confirm your registration, please click on the link below: <a href="http://localhost:8080/api/users/verify/${verificationToken}">Click me</a>`,
    });
    res.status(201).json({
      status: "success",
      code: 201,
      data: {
        message: "Registration successful",
      },
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  const { error } = userValidator(req.body);
  if (error) {
    throw HttpError(400, "Email or password is missing");
  }

  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user || !user.validPassword(password) || !user.verify) {
    return res.status(401).json({
      status: "error",
      code: 401,
      message: "Incorrect email or password",
      data: "Unauthorized",
    });
  }

  const payload = {
    id: user.id,
    email: user.email,
  };

  const token = jwt.sign(payload, secret, { expiresIn: "23h" });
 
  await User.findByIdAndUpdate(user._id, { token });
  res.status(200).json({
    status: "success",
    code: 200,
    data: {
      token,
      user: {
        email: user.email,
        subscription: user.subscription,
      },
    },
  });
};

const logout = async (req, res, next) => {
  try {
    const { _id } = req.user;
    await User.findByIdAndUpdate(_id, { token: "" });
    res.json({
      status: "success",
      code: 204,
      data: {
        message: "No content",
      },
    });
  } catch (error) {
    next(error);
  }
};

const current = async (req, res, next) => {
  try {
    const user = await service.getUser({ _id: req.user._id });
    if (!user) {
      throw HttpError(409, "Email in use");
    } else {
      res.json({
        status: "success",
        code: 200,
        data: {
          user,
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

const getUsers = async (req, res) => {
  const { email } = req.user;
  res.json({
    status: "success",
    code: 200,
    data: {
      message: `Authorization was successful: ${email}`,
    },
  });
};

const updateSubscription = async (req, res, next) => {
  try {
    const { error } = userValidator(req.body);
    if (error) {
      throw HttpError(400, "Avatar must be provided");
    }
    const { subscription } = req.body;
    const { userId } = req.params;

    if (!subscription) {
      throw HttpError(400, "missing field subscription");
    }
    const user = await service.updateUserSubscription(userId, subscription);

    if (user) {
      res.status(200).json(user);
    } else {
      throw HttpError(404, `Not found`);
    }
  } catch (error) {
    console.error(error.message);
    next(error);
  }
};

const updateAvatar = async (req, res, next) => {
  if (!req.file) {
    throw HttpError(400, "Avatar must be provided");
  }

  const { _id } = req.user;
  const { path: tempUpload, originalname } = req.file;

  await Jimp.read(tempUpload)
    .then((avatar) => {
      return avatar
        .resize(250, 250) // resize
        .quality(60) // set JPEG quality
        .write(tempUpload); // save
    })
    .catch((err) => {
      throw err;
    });

  const fileName = `${_id}_${originalname}`;

  const publicUpload = path.join(avatarDir, fileName);

  await fs.rename(tempUpload, publicUpload);

  const avatarUrl = path.join("avatars", fileName);

  await User.findByIdAndUpdate(_id, { avatarUrl });

  res.json({
    avatarUrl,
  });
};

const deleteUserByMail = async (req, res) => {
  try {
    const email = req.query.email;
    const userToRemove = await service.deleteUser(email);
    if (!userToRemove) {
      throw HttpError(404, `Not found`);
    } else {
      res.status(200).json({ message: "User deleted from data base" });
    }
  } catch (error) {
    console.log(`Error: ${error.message}`.red);
  }
};

const verifyUserByToken = async (req, res) => {
  try {
    const token = req.params.verificationToken;
    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      throw HttpError(404, `Not found`);
    } else {
      await service.updateUserVerification(user.id);
      res.status(200).json({ message: "Verification successful" });
    }
  } catch (error) {
    console.log(`Error: ${error.message}`.red);
  }
};

const resendVerificationMail = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ message: "missing required field email" });
  }
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Incorrect email ",
    });
  }
  if (user.validate) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Verification has already been passed",
    });
  }
  if (!user.validate) {
    await sendEmail({
      to: email,
      subject: `Welcome on board, ${email}`,
      html: `To confirm your registration, please click on the link below: <a href="http://localhost:8080/api/users/verify/${user.verificationToken}">Click me</a>`,
      text: `To confirm your registration, please open the link below: http://localhost:8080/api/users/verify/${user.verificationToken}`,
    });
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Verification has already been passed",
    });
  }
};
module.exports = {
  register,
  login,
  logout,
  current,
  getUsers,
  updateSubscription,
  updateAvatar,
  deleteUserByMail,
  verifyUserByToken,
  resendVerificationMail,
};
