const Sequelize = require('sequelize');
const {DataTypes, Op} = Sequelize;

// const DataTypes = Sequelize.DataTypes;

// const mysql = require('mysql2');

// const connection = mysql.createConnection({
//     host: process.env.HT || '172.17.0.2',
//     user: process.env.USR || 'root',
//     password: process.env.PW || 'pruebas',
//     database: process.env.DB || 'celex'
// });

// connection.query('SELECT COUNT(*) as total FROM courses', (err, results, fields) => {
//     console.log('err : ', err);
//     console.log('results : ', results);
//     console.log('fields : ', fields);
// });

// connection
//     .then()

class Persistence {
    processData (data) {
        // console.log('processData : ', data.length);
        // console.log('processData : ', JSON.stringify(data));
        // console.log('courses : ', data.reduce((acc, v) => acc.add(v.language), new Set()));
        // console.log('grade : ', data.reduce((acc, v) => acc.add(v.level), new Set()));
        // console.log('teachers : ', data.reduce((acc, v) => acc.add(v.teacher), new Set()));
        // console.log('students : ', data.reduce((acc, v) => new Set(Array.from(acc).concat(v.students)), new Set()));

        const dataCourses = data.reduce((acc, v) => acc.add(v.language), new Set());
        const dataGrades = data.reduce((acc, v) => acc.add(v.level), new Set());
        const dataTeachers = data.reduce((acc, v) => acc.add(v.teacher), new Set());
        const dataStudents = data.reduce((acc, v) => new Set(Array.from(acc).concat(v.students)), new Set());

        const sequelize = this.getConnection();
        this.configEntities(sequelize);

        Promise.all([
            this.getCoursesPersisted(dataCourses),
            this.getGradesPersisted(dataGrades),
            this.getTeachersPersisted(dataTeachers),
            this.getStudentsPersisted(dataStudents),
        ]).then(([courses, grades, teachers, students]) => {
            let processCourses = this.processCourses(courses, dataCourses);
            let processGrades = this.processGrades(grades, dataGrades);
            let processTeachers = this.processTeachers(teachers, dataTeachers);
            let processStudents = this.processStudents(students, dataStudents);

            this.generateNewInfo(processCourses, processGrades, processTeachers, processStudents, sequelize)
                .then(res => console.log('transaction - done') || sequelize.close())
                .catch(err => console.log('transaction - error : ', err) || sequelize.close());
        }).catch(err => console.log('error : ', err) || sequelize.close());

        // Promise.all([
        //     this.Course.findAll(),
        //     this.Grade.findAll(),
        //     this.Student.findAll(),
        //     this.Teacher.findAll(),
        //     this.Group.findAll(),
        //     this.GroupStudent.findAll(),
        // ]).then(results => {
        //     console.log('done');
        //     console.log('data course : ', results[0]);
        //     console.log('data grade : ', results[1]);
        //     console.log('data student : ', results[2]);
        //     console.log('data teacher : ', results[3]);
        //     console.log('data group : ', results[4]);
        //     console.log('data groupStudent : ', results[5]);
        //     sequelize.close();
        //     console.log('connection closed');
        // }).catch(err => console.log('error : ', err));
    }

    generateNewInfo (processCourses, processGrades, processTeachers, processStudents, sequelize) {
        // console.log('processCourses => ', processCourses);
        // console.log('processGrades => ', processGrades);
        // console.log('processTeachers => ', processTeachers);
        // console.log('processStudents => ', processStudents);
        return sequelize.transaction(tx => Promise.all([
            this.createNewCourses(processCourses, tx),
            this.createNewGrades(processGrades, tx),
            this.createNewTeachers(processTeachers, tx),
            this.createNewStudents(processStudents, tx),
        ]).then(([newCourses, newGrades, newTeachers, newStudents]) => {
            console.log('new data - done');
            return new Promise(solve => solve());
        }));
    }

    createNewCourses (processCourses, tx) {
        let data = Array.from(processCourses.newData).map(element => ({name: element}));
        return this.Course.bulkCreate(data, {transaction: tx});
        // return new Promise(solve => console.log('message 1') || solve());
    }

    createNewGrades (processGrades, tx) {
        let data = Array.from(processGrades.newData).map(element => ({name: element}));
        return this.Grade.bulkCreate(data, {transaction: tx});
        // return new Promise(solve => console.log('message 2') || solve());
    }

    createNewTeachers (processTeachers, tx) {
        let data = Array.from(processTeachers.newData).map(element => ({name: element}));
        return this.Teacher.bulkCreate(data, {transaction: tx});
        // return new Promise(solve => console.log('message 3') || solve());
    }

    createNewStudents (processStudents, tx) {
        let data = Array.from(processStudents.newData).map(element => ({name: element}));
        return this.Student.bulkCreate(data, {transaction: tx});
        // return new Promise(solve => console.log('message 4') || solve());
    }

    processCourses (courses, dataCourses) {
        // console.log('courses : ', courses);
        let persisted = new Map();

        // for (let persisted of courses.items) {
        for (let course of courses) {
            persisted.set(course.dataValues.name, course.dataValues);
            if (dataCourses.has(course.dataValues.name)) dataCourses.delete(course.dataValues.name);
        }

        return {
            newData : dataCourses,
            persisted
        };
    }

    processGrades (grades, dataGrades) {
        // console.log('grades : ', grades);
        let persisted = new Map();

        // for (let persisted of courses.items) {
        for (let grade of grades) {
            persisted.set(grade.dataValues.name, grade.dataValues);
            if (dataGrades.has(grade.dataValues.name)) dataGrades.delete(grade.dataValues.name);
        }

        return {
            newData : dataGrades,
            persisted
        };
    }

    processTeachers (teachers, dataTeachers) {
        // console.log('teachers : ', teachers);
        let persisted = new Map();

        // for (let persisted of courses.items) {
        for (let teacher of teachers) {
            persisted.set(teacher.dataValues.name, teacher.dataValues);
            if (dataTeachers.has(teacher.dataValues.name)) dataTeachers.delete(teacher.dataValues.name);
        }

        return {
            newData : dataTeachers,
            persisted
        };
    }

    processStudents (students, dataStudents) {
        // console.log('students : ', students);
        let persisted = new Map();

        // for (let persisted of courses.items) {
        for (let student of students) {
            persisted.set(student.dataValues.name, student.dataValues);
            if (dataStudents.has(student.dataValues.name)) dataStudents.delete(student.dataValues.name);
        }

        return {
            newData : dataStudents,
            persisted
        };
    }

    getCoursesPersisted (dataCourses) {
        return this.Course.findAll({
            where: {
                name: {
                    [Op.or]: Array.from(dataCourses)
                }
            }
        });
    }

    getGradesPersisted (dataGrade) {
        return this.Grade.findAll({
            where: {
                name: {
                    [Op.or]: Array.from(dataGrade)
                }
            }
        });
    }

    getTeachersPersisted (dataTeachers) {
        return this.Teacher.findAll({
            where: {
                name: {
                    [Op.or]: Array.from(dataTeachers)
                }
            }
        });
    }

    getStudentsPersisted (dataStudents) {
        return this.Student.findAll({
            where: {
                name: {
                    [Op.or]: Array.from(dataStudents)
                }
            }
        });
    }

    getConnection () {
        return new Sequelize({
            database: process.env.DB || 'celex',
            username: process.env.USR || 'root',
            host: process.env.HT || '172.17.0.2',
            port: process.env.PT || '3306',
            password: process.env.PW || 'pruebas',
            define: {
                timestamps: false
            },
            // pool: {
            //     max: 500,
            //     min: 0,
            //     idle: 30000,
            //     acquire: 60000
            // },
            logging: false,
            // options: {
            //     allowPublicKeyRetrieval: true
            // },
            dialect: process.env.DD || 'mysql'
        });
    }

    configEntities (sequelize) {
        this.Course = this.configEntityCourses(sequelize);
        this.Grade = this.configEntityGrades(sequelize);
        this.Student = this.configEntityStudents(sequelize);
        this.Teacher = this.configEntityTeachers(sequelize);
        this.Group = this.configEntityGroups(sequelize);
        // this.Group.hasOne(this.Course);
        // this.Group.hasOne(this.Grade);
        // this.Group.hasOne(this.Teacher);
        this.Group.belongsTo(this.Course, {foreignKey: 'id_course'});
        this.Group.belongsTo(this.Grade, {foreignKey: 'id_grade'});
        this.Group.belongsTo(this.Teacher, {foreignKey: 'id_teacher'});
        this.GroupStudent = this.configEntityGroupStudent(sequelize);
        this.GroupStudent.removeAttribute('id');
        // this.GroupStudent.belongsToMany(this.Group);
        // this.GroupStudent.belongsToMany(this.Student);
        // this.Student.belongsTo(this.Group, {
        //     through: {
        //         model: this.GroupStudent,
        //         scope: {

        //         }
        //     }
        // });
        // this.Student.belongsTo(this.Group, {as: 'Group', through: 'GroupStudent'});
        this.Student.belongsToMany(this.Group, {as: 'Group', through: 'GroupStudent'});
    }

    configEntityCourses (sequelize) {
        return sequelize.define('course', {
            idCourse : {
                field: 'id_course',
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name : {
                field: 'name',
                type: DataTypes.STRING,
                allowNull: false
            }
        });
    }
    configEntityGrades (sequelize) {
        return sequelize.define('grade', {
            idGrade : {
                field: 'id_grade',
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name : {
                field: 'name',
                type: DataTypes.STRING,
                allowNull: false
            }
        });
    }
    configEntityStudents (sequelize) {
        return sequelize.define('student', {
            idStudent : {
                field: 'id_student',
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name : { 
                field: 'name',
                type: DataTypes.STRING,
                allowNull: false
            }
        });
    }
    configEntityTeachers (sequelize) {
        return sequelize.define('teacher', {
            idTeacher : {
                field: 'id_teacher',
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name : {
                field: 'name',
                type: DataTypes.STRING,
                allowNull: false
            }
        });
    }
    configEntityGroups (sequelize) {
        return sequelize.define('group', {
            idGroup : {
                field: 'id_group',
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            schedule : {
                field: 'schedule',
                type: DataTypes.STRING,
                allowNull: false
            },
            publication : {
                field: 'publication',
                type: DataTypes.DATE,
                allowNull: false
            },
            bimester : {
                field: 'bimester',
                type: DataTypes.STRING,
                allowNull: false
            },
            classroom : {
                field: 'classroom',
                type: DataTypes.STRING,
                allowNull: false
            },
            idCourse : {
                field: 'id_course',
                type: DataTypes.INTEGER,
                allowNull: false
            },
            idGrade : {
                field: 'id_grade',
                type: DataTypes.INTEGER,
                allowNull: false
            },
            idTeacher : {
                field: 'id_teacher',
                type: DataTypes.INTEGER,
                allowNull: false
            }
        });
    }
    configEntityGroupStudent (sequelize) {
        return sequelize.define('groupStudent', {
            idGroup : {
                field: 'id_group',
                type: DataTypes.INTEGER,
                allowNull: false
            },
            idStudent : { 
                field: 'id_student',
                type: DataTypes.INTEGER,
                allowNull: false
            }
        }, {
            tableName: 'group_student'
        });
    }
}

module.exports = Persistence;